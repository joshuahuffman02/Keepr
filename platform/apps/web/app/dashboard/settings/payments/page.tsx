"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";
import { HelpAnchor } from "@/components/help/HelpAnchor";
import { TerminalManagement } from "@/components/settings/TerminalManagement";
import { PaymentMethodsConfig } from "@/components/settings/PaymentMethodsConfig";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Settings2, Smartphone } from "lucide-react";
import {
  PaymentSetupProgress,
  GettingStartedCard,
  StripeConnectCard,
  PlatformFeeCard,
  StripeSettingsCard,
} from "@/components/settings/payments";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "string") return error;
  if (isRecord(error) && typeof error.message === "string") return error.message;
  return fallback;
};

export default function PaymentsSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [campgroundId, setCampgroundId] = useState<string>("");
  const [refreshingCapabilities, setRefreshingCapabilities] = useState(false);
  const [feeSaveSuccess, setFeeSaveSuccess] = useState(false);
  const [stripeSaveSuccess, setStripeSaveSuccess] = useState(false);

  // @ts-ignore - platformRole not in NextAuth v5 beta types (works at runtime)
  const isPlatformAdmin = session?.user?.platformRole === "platform_admin";

  // Get campground ID from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setCampgroundId(stored);
  }, []);

  // Fetch payment settings
  const { data: paymentSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ["payment-settings", campgroundId],
    queryFn: () => apiClient.getCampgroundPaymentSettings(campgroundId),
    enabled: !!campgroundId,
    staleTime: 30_000,
  });

  // Fetch gateway config
  const { data: gatewayConfig, isLoading: gatewayLoading } = useQuery({
    queryKey: ["payment-gateway", campgroundId],
    queryFn: () => apiClient.getPaymentGatewayConfig(campgroundId),
    enabled: !!campgroundId,
  });

  // Connect Stripe mutation
  const connectMutation = useMutation({
    mutationFn: () => apiClient.connectCampgroundPayments(campgroundId),
    onSuccess: ({ onboardingUrl }) => {
      window.location.href = onboardingUrl;
    },
    onError: (err: Error) => {
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    },
  });

  // Update fee settings mutation
  const updateFeeMutation = useMutation({
    mutationFn: (payload: {
      perBookingFeeCents: number;
      billingPlan: "ota_only" | "standard" | "enterprise";
      feeMode: "absorb" | "pass_through";
      monthlyFeeCents?: number;
    }) => apiClient.updateCampgroundPaymentSettings(campgroundId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-settings", campgroundId] });
      setFeeSaveSuccess(true);
      toast({ title: "Settings saved", description: "Platform fee settings updated." });
      setTimeout(() => setFeeSaveSuccess(false), 2000);
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  // Update Stripe settings mutation
  const updateStripeMutation = useMutation({
    mutationFn: (payload: { mode: "test" | "prod"; feeMode: "absorb" | "pass_through" }) =>
      apiClient.upsertPaymentGatewayConfig(campgroundId, {
        gateway: "stripe",
        mode: payload.mode,
        feeMode: payload.feeMode,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-gateway", campgroundId] });
      setStripeSaveSuccess(true);
      toast({ title: "Settings saved", description: "Stripe settings updated." });
      setTimeout(() => setStripeSaveSuccess(false), 2000);
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  // Refresh capabilities handler
  const handleRefreshCapabilities = async () => {
    setRefreshingCapabilities(true);
    try {
      await apiClient.refreshPaymentCapabilities(campgroundId);
      queryClient.invalidateQueries({ queryKey: ["payment-settings", campgroundId] });
      toast({
        title: "Capabilities refreshed",
        description: "Payment method status updated from Stripe.",
      });
    } catch (err: unknown) {
      toast({
        title: "Refresh failed",
        description: getErrorMessage(err, "Refresh failed"),
        variant: "destructive",
      });
    } finally {
      setRefreshingCapabilities(false);
    }
  };

  const isLoading = settingsLoading || gatewayLoading;
  const isConnected = !!paymentSettings?.stripeAccountId;
  const hasConfiguredFees = paymentSettings?.perBookingFeeCents !== undefined;

  // Loading state
  if (!campgroundId) {
    return (
      <div className="max-w-3xl">
        <div className="flex items-center gap-2 mb-4">
          <h1 className="text-2xl font-semibold text-foreground">Payments</h1>
          <HelpAnchor topicId="payments-config" label="Payments setup help" />
        </div>
        <div className="p-8 text-center text-muted-foreground">
          <p>Select a campground to configure payment settings.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl">
        <div className="flex items-center gap-2 mb-4">
          <h1 className="text-2xl font-semibold text-foreground">Payments</h1>
          <HelpAnchor topicId="payments-config" label="Payments setup help" />
        </div>
        <div className="space-y-4">
          {/* Skeleton loading state */}
          <div className="h-20 bg-muted rounded-xl animate-pulse" />
          <div className="h-48 bg-muted rounded-xl animate-pulse" />
          <div className="h-64 bg-muted rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground">Payments</h1>
          <HelpAnchor topicId="payments-config" label="Payments setup help" />
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          Configure how you accept payments from guests.
        </p>
      </div>

      {/* Setup Progress - only show if not fully configured */}
      <PaymentSetupProgress
        stripeConnected={isConnected}
        feesConfigured={hasConfiguredFees}
        testPaymentMade={false}
      />

      {/* Tabs */}
      <Tabs defaultValue="gateway" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1">
          <TabsTrigger
            value="gateway"
            className="flex items-center gap-2 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            <CreditCard className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Gateway & Fees</span>
            <span className="sm:hidden">Gateway</span>
          </TabsTrigger>
          <TabsTrigger
            value="methods"
            className="flex items-center gap-2 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            <Smartphone className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Payment Methods</span>
            <span className="sm:hidden">Methods</span>
          </TabsTrigger>
          <TabsTrigger
            value="terminals"
            className="flex items-center gap-2 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm"
          >
            <Settings2 className="w-4 h-4" aria-hidden="true" />
            <span>Terminals</span>
          </TabsTrigger>
        </TabsList>

        {/* Gateway & Fees Tab */}
        <TabsContent
          value="gateway"
          className="space-y-6 mt-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
        >
          {/* Show getting started if not connected */}
          {!isConnected ? (
            <GettingStartedCard
              onConnect={() => connectMutation.mutate()}
              isConnecting={connectMutation.isPending}
            />
          ) : (
            <>
              {/* Stripe Connect Card */}
              <StripeConnectCard
                stripeAccountId={paymentSettings?.stripeAccountId ?? null}
                capabilities={paymentSettings?.stripeCapabilities || {}}
                capabilitiesFetchedAt={paymentSettings?.stripeCapabilitiesFetchedAt ?? null}
                onConnect={() => connectMutation.mutate()}
                onRefreshCapabilities={handleRefreshCapabilities}
                isConnecting={connectMutation.isPending}
                isRefreshing={refreshingCapabilities}
                campgroundId={campgroundId}
              />

              {/* Platform Fee Card - Only visible to platform admins */}
              {isPlatformAdmin && (
                <PlatformFeeCard
                  initialFee={paymentSettings?.perBookingFeeCents ?? undefined}
                  initialPlan={paymentSettings?.billingPlan}
                  initialFeeMode={paymentSettings?.feeMode}
                  initialMonthlyFee={paymentSettings?.monthlyFeeCents ?? undefined}
                  onSave={(data) => updateFeeMutation.mutate(data)}
                  isSaving={updateFeeMutation.isPending}
                  saveSuccess={feeSaveSuccess}
                  disabled={!campgroundId}
                />
              )}

              {/* Stripe Settings Card */}
              <StripeSettingsCard
                initialMode={gatewayConfig?.mode ?? "test"}
                initialFeeMode={gatewayConfig?.feeMode ?? "absorb"}
                effectiveFee={gatewayConfig?.effectiveFee}
                onSave={(data) => updateStripeMutation.mutate(data)}
                isSaving={updateStripeMutation.isPending}
                saveSuccess={stripeSaveSuccess}
                disabled={!campgroundId}
              />
            </>
          )}
        </TabsContent>

        {/* Payment Methods Tab */}
        <TabsContent
          value="methods"
          className="mt-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
        >
          <PaymentMethodsConfig campgroundId={campgroundId} />
        </TabsContent>

        {/* Terminals Tab */}
        <TabsContent
          value="terminals"
          className="mt-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
        >
          <TerminalManagement campgroundId={campgroundId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
