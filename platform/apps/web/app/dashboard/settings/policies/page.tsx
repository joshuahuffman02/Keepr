"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DepositSettingsForm } from "../../../../components/settings/DepositSettingsForm";
import { SettingsPageLayout } from "../../../../components/settings/SettingsPageLayout";
import { apiClient } from "../../../../lib/api-client";
import type { DepositConfig } from "@campreserv/shared";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import { Textarea } from "../../../../components/ui/textarea";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { useToast } from "../../../../components/ui/use-toast";
import { Loader2, DollarSign, Calendar, FileText, ArrowRight } from "lucide-react";
import Link from "next/link";

function FormsInfoBanner() {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-4">
      <div className="flex items-start gap-3">
        <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Looking for legal documents and waivers?</p>
          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
            Park rules, liability waivers, and other legal documents have moved to the Forms page.
          </p>
          <Link
            href="/forms"
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mt-2"
          >
            Go to Forms & Documents
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function BookingRulesPage() {
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [policyForm, setPolicyForm] = useState({
    cancellationPolicyType: "",
    cancellationWindowHours: "",
    cancellationFeeType: "",
    cancellationFeeFlatCents: "",
    cancellationFeePercent: "",
    cancellationNotes: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const id = localStorage.getItem("campreserv:selectedCampground");
    setCampgroundId(id);
  }, []);

  const campgroundQuery = useQuery({
    queryKey: ["campground", campgroundId],
    queryFn: () => apiClient.getCampground(campgroundId!),
    enabled: !!campgroundId,
  });

  useEffect(() => {
    const cg = campgroundQuery.data as {
      cancellationPolicyType?: string | null;
      cancellationWindowHours?: number | null;
      cancellationFeeType?: string | null;
      cancellationFeeFlatCents?: number | null;
      cancellationFeePercent?: number | null;
      cancellationNotes?: string | null;
    } | undefined;
    if (!cg) return;
    setPolicyForm({
      cancellationPolicyType: cg.cancellationPolicyType || "",
      cancellationWindowHours: cg.cancellationWindowHours ? String(cg.cancellationWindowHours) : "",
      cancellationFeeType: cg.cancellationFeeType || "",
      cancellationFeeFlatCents: cg.cancellationFeeFlatCents ? String(cg.cancellationFeeFlatCents) : "",
      cancellationFeePercent: cg.cancellationFeePercent ? String(cg.cancellationFeePercent) : "",
      cancellationNotes: cg.cancellationNotes || "",
    });
  }, [campgroundQuery.data]);

  const savePolicyMutation = useMutation({
    mutationFn: () =>
      apiClient.updateCampgroundPolicies(campgroundId!, {
        cancellationPolicyType: policyForm.cancellationPolicyType || null,
        cancellationWindowHours: policyForm.cancellationWindowHours ? Number(policyForm.cancellationWindowHours) : null,
        cancellationFeeType: policyForm.cancellationFeeType || null,
        cancellationFeeFlatCents: policyForm.cancellationFeeFlatCents ? Number(policyForm.cancellationFeeFlatCents) : null,
        cancellationFeePercent: policyForm.cancellationFeePercent ? Number(policyForm.cancellationFeePercent) : null,
        cancellationNotes: policyForm.cancellationNotes || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campground", campgroundId] });
      toast({ title: "Booking rules updated" });
    },
    onError: () => toast({ title: "Failed to update booking rules", variant: "destructive" }),
  });

  return (
    <SettingsPageLayout
      title="Booking Rules"
      description="Configure deposit requirements and cancellation policies for reservations."
      icon={DollarSign}
      helpTopicId="policies-rules"
      isLoading={campgroundQuery.isLoading}
      hasCampground={!!campgroundId}
      emptyMessage="Please select a campground to view settings."
      infoBanner={<FormsInfoBanner />}
    >
      {/* Error State */}
      {!campgroundQuery.data && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-red-500">Failed to load campground settings.</p>
          </CardContent>
        </Card>
      )}

      {campgroundQuery.data && (
        <>
          {/* Deposit Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                <CardTitle>Deposit Settings</CardTitle>
              </div>
              <CardDescription>Configure deposit requirements for reservations.</CardDescription>
            </CardHeader>
            <CardContent>
              <DepositSettingsForm
                campgroundId={campgroundId!}
                initialRule={campgroundQuery.data.depositRule ?? ""}
                initialPercentage={campgroundQuery.data.depositPercentage ?? null}
                initialConfig={(campgroundQuery.data as { depositConfig?: DepositConfig | null }).depositConfig ?? null}
              />
            </CardContent>
          </Card>

          {/* Cancellation Policy */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-amber-600" />
                <CardTitle>Cancellation Policy</CardTitle>
              </div>
              <CardDescription>Define policy type, window, and fee for cancellations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Policy Type</Label>
                  <Select
                    value={policyForm.cancellationPolicyType}
                    onValueChange={(v) => setPolicyForm((f) => ({ ...f, cancellationPolicyType: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flexible">Flexible</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="strict">Strict</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cancel Window (hours before arrival)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={policyForm.cancellationWindowHours}
                    onChange={(e) => setPolicyForm((f) => ({ ...f, cancellationWindowHours: e.target.value }))}
                    placeholder="48"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fee Type</Label>
                  <Select
                    value={policyForm.cancellationFeeType}
                    onValueChange={(v) => setPolicyForm((f) => ({ ...f, cancellationFeeType: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select fee" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="flat">Flat amount</SelectItem>
                      <SelectItem value="percent">Percent</SelectItem>
                      <SelectItem value="first_night">First night</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Flat Fee (cents)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={policyForm.cancellationFeeFlatCents}
                    onChange={(e) => setPolicyForm((f) => ({ ...f, cancellationFeeFlatCents: e.target.value }))}
                    placeholder="2500"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fee Percent (0-100)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={policyForm.cancellationFeePercent}
                    onChange={(e) => setPolicyForm((f) => ({ ...f, cancellationFeePercent: e.target.value }))}
                    placeholder="25"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  rows={3}
                  value={policyForm.cancellationNotes}
                  onChange={(e) => setPolicyForm((f) => ({ ...f, cancellationNotes: e.target.value }))}
                  placeholder="Additional details shown to staff and guests..."
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => savePolicyMutation.mutate()} disabled={savePolicyMutation.isPending}>
              {savePolicyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {savePolicyMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </>
      )}
    </SettingsPageLayout>
  );
}
