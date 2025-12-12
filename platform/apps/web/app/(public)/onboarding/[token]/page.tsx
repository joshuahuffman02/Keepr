"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { onboardingSteps, onboardingStepOrder, OnboardingStepKey } from "@/lib/onboarding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

type StepData = Partial<Record<OnboardingStepKey, any>>;

export default function OnboardingPage() {
  const params = useParams();
  const token = params.token as string;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [draft, setDraft] = useState<StepData>({});
  const [activeStep, setActiveStep] = useState<OnboardingStepKey>("account_profile");

  const sessionQuery = useQuery({
    queryKey: ["onboarding", token],
    queryFn: () => apiClient.startOnboardingSession(token),
    enabled: Boolean(token)
  });

  useEffect(() => {
    if (sessionQuery.data?.session) {
      setDraft((prev) => ({ ...prev, ...(sessionQuery.data?.session.data ?? {}) }));
      const next = (sessionQuery.data.progress.nextStep ??
        sessionQuery.data.session.currentStep ??
        onboardingStepOrder[0]) as OnboardingStepKey;
      setActiveStep(next);
    }
  }, [sessionQuery.data]);

  const progressValue = sessionQuery.data?.progress?.percentage ?? 0;
  const completed = new Set<OnboardingStepKey>(sessionQuery.data?.progress?.completedSteps ?? []);

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      if (!sessionQuery.data) throw new Error("Session not ready");
      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `onb-${Date.now()}`;
      return apiClient.saveOnboardingStep(
        sessionQuery.data.session.id,
        token,
        activeStep,
        payload,
        idempotencyKey
      );
    },
    onSuccess: (resp, payload) => {
      queryClient.setQueryData(["onboarding", token], resp);
      setDraft((prev) => ({ ...prev, [activeStep]: payload }));
      const next = (resp.progress.nextStep ?? activeStep) as OnboardingStepKey;
      setActiveStep(next);
      toast({ title: "Saved", description: "Progress updated." });
    },
    onError: (err: any) => {
      toast({
        title: "Could not save",
        description: err?.message ?? "Please try again.",
        variant: "destructive"
      });
    }
  });

  const activeData = draft[activeStep] ?? {};

  const statusCopy = useMemo(() => {
    if (!sessionQuery.data?.progress) return "Start your setup to get online faster.";
    if (sessionQuery.data.progress.remainingSteps.length === 0) return "All steps completed!";
    return `${sessionQuery.data.progress.completedSteps.length}/${onboardingSteps.length} steps done`;
  }, [sessionQuery.data?.progress]);

  if (sessionQuery.isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-600">
        Preparing your onboarding workspace...
      </div>
    );
  }

  if (sessionQuery.error || !sessionQuery.data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle>Link problem</CardTitle>
            <CardDescription>We could not validate this onboarding link. Request a new invite or contact support.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto py-10 px-4">
        <div className="flex flex-col md:flex-row gap-6">
          <aside className="md:w-72 space-y-4">
            <Card>
              <CardHeader className="space-y-2">
                <CardTitle>Guided onboarding</CardTitle>
                <CardDescription>{statusCopy}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={progressValue} max={100} />
                <div className="text-xs text-slate-500">We autosave every step. You can close this tab and resume later.</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Steps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {onboardingSteps.map((step) => {
                  const isActive = step.key === activeStep;
                  const isDone = completed.has(step.key);
                  return (
                    <button
                      key={step.key}
                      className={cn(
                        "w-full text-left rounded-lg border px-3 py-2 transition",
                        isActive ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white",
                        isDone ? "opacity-100" : "opacity-90"
                      )}
                      onClick={() => setActiveStep(step.key)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                          <p className="text-xs text-slate-500">{step.description}</p>
                        </div>
                        {isDone ? (
                          <span className="text-emerald-600 text-xs font-semibold">Done</span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </aside>

          <main className="flex-1">
            <Card>
              <CardHeader>
                <CardTitle>{onboardingSteps.find((s) => s.key === activeStep)?.title}</CardTitle>
                <CardDescription>{onboardingSteps.find((s) => s.key === activeStep)?.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <StepFields
                  step={activeStep}
                  value={activeData}
                  onChange={(updates) => setDraft((prev) => ({ ...prev, [activeStep]: { ...activeData, ...updates } }))}
                />

                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-slate-500">Token: {token.slice(0, 6)}…</div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        const currentIndex = onboardingStepOrder.indexOf(activeStep);
                        if (currentIndex > 0) setActiveStep(onboardingStepOrder[currentIndex - 1]);
                      }}
                    >
                      Previous
                    </Button>
                    <Button
                      onClick={() => saveMutation.mutate(draft[activeStep] ?? {})}
                      disabled={saveMutation.isPending}
                    >
                      {saveMutation.isPending ? "Saving..." : "Save & Continue"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </div>
  );
}

function StepFields({
  step,
  value,
  onChange
}: {
  step: OnboardingStepKey;
  value: Record<string, any>;
  onChange: (val: Record<string, any>) => void;
}) {
  switch (step) {
    case "account_profile":
      return (
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Campground name" value={value.campgroundName} onChange={(v) => onChange({ campgroundName: v })} />
          <Field label="Contact name" value={value.contactName} onChange={(v) => onChange({ contactName: v })} />
          <Field label="Contact email" value={value.contactEmail} onChange={(v) => onChange({ contactEmail: v })} />
          <Field label="Phone" value={value.phone} onChange={(v) => onChange({ phone: v })} />
          <Field label="Timezone" value={value.timezone} onChange={(v) => onChange({ timezone: v })} />
        </div>
      );
    case "payment_gateway":
      return (
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Gateway provider" value={value.provider} onChange={(v) => onChange({ provider: v })} />
          <Field label="Account ID (if already connected)" value={value.accountId} onChange={(v) => onChange({ accountId: v })} />
          <Field label="Payout schedule" value={value.payoutSchedule} onChange={(v) => onChange({ payoutSchedule: v })} />
        </div>
      );
    case "taxes_and_fees":
      return (
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="State/Lodging tax %" value={value.lodgingTaxRate} onChange={(v) => onChange({ lodgingTaxRate: v })} />
          <Field label="Local tax %" value={value.localTaxRate} onChange={(v) => onChange({ localTaxRate: v })} />
          <Field label="Fee notes" value={value.feeNotes} onChange={(v) => onChange({ feeNotes: v })} textarea />
        </div>
      );
    case "inventory_sites":
      return (
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Number of sites" value={value.siteCount} onChange={(v) => onChange({ siteCount: v })} />
          <Field label="Primary rig types" value={value.primaryRigTypes} onChange={(v) => onChange({ primaryRigTypes: v })} />
          <SwitchField label="Group sites available" checked={Boolean(value.hasGroups)} onCheckedChange={(checked) => onChange({ hasGroups: checked })} />
        </div>
      );
    case "rates_and_fees":
      return (
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Base nightly rate" value={value.baseNightlyRate} onChange={(v) => onChange({ baseNightlyRate: v })} />
          <Field label="Deposit %" value={value.depositPercent} onChange={(v) => onChange({ depositPercent: v })} />
          <Field label="Add-on notes" value={value.addOnNotes} onChange={(v) => onChange({ addOnNotes: v })} textarea />
        </div>
      );
    case "policies":
      return (
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Check-in time" value={value.checkInTime} onChange={(v) => onChange({ checkInTime: v })} />
          <Field label="Check-out time" value={value.checkOutTime} onChange={(v) => onChange({ checkOutTime: v })} />
          <Field label="Cancellation policy" value={value.cancellationPolicy} onChange={(v) => onChange({ cancellationPolicy: v })} textarea />
        </div>
      );
    case "communications_templates":
      return (
        <div className="space-y-4">
          <SwitchField
            label="Enable SMS notifications"
            checked={Boolean(value.enableSms)}
            onCheckedChange={(checked) => onChange({ enableSms: checked })}
          />
          <Field label="Sender name" value={value.senderName} onChange={(v) => onChange({ senderName: v })} />
          <Field label="Welcome template notes" value={value.welcomeTemplate} onChange={(v) => onChange({ welcomeTemplate: v })} textarea />
        </div>
      );
    case "pos_hardware":
      return (
        <div className="space-y-4">
          <SwitchField
            label="Card readers/terminals on site"
            checked={Boolean(value.hasTerminals)}
            onCheckedChange={(checked) => onChange({ hasTerminals: checked })}
          />
          <SwitchField
            label="Self-serve kiosk planned"
            checked={Boolean(value.needsKiosk)}
            onCheckedChange={(checked) => onChange({ needsKiosk: checked })}
          />
          <Field label="Preferred provider" value={value.primaryProvider} onChange={(v) => onChange({ primaryProvider: v })} />
        </div>
      );
    case "imports":
      return (
        <div className="space-y-4">
          <Field label="Source PMS or files" value={value.sourceSystem} onChange={(v) => onChange({ sourceSystem: v })} />
          <SwitchField
            label="Need data migration help"
            checked={Boolean(value.needsDataMigration)}
            onCheckedChange={(checked) => onChange({ needsDataMigration: checked })}
          />
          <Field label="Upload/notes" value={value.attachmentsHint} onChange={(v) => onChange({ attachmentsHint: v })} textarea />
        </div>
      );
    default:
      return null;
  }
}

function Field({
  label,
  value,
  onChange,
  textarea
}: {
  label: string;
  value: any;
  onChange: (value: any) => void;
  textarea?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      {textarea ? (
        <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function SwitchField({
  label,
  checked,
  onCheckedChange
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
