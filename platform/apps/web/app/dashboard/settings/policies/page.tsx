"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DepositSettingsForm } from "../../../../components/settings/DepositSettingsForm";
import { apiClient } from "../../../../lib/api-client";
import type { DepositConfig } from "@campreserv/shared";
import { HelpAnchor } from "@/components/help/HelpAnchor";
import { Input } from "../../../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import { Textarea } from "../../../../components/ui/textarea";
import { Button } from "../../../../components/ui/button";
import { useToast } from "../../../../components/ui/use-toast";
import { AlertCircle, DollarSign, Calendar, FileText, ArrowRight } from "lucide-react";
import Link from "next/link";

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
    <div className="space-y-6">
      <div className="card p-6 space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 text-white">
            <DollarSign className="h-4 w-4" />
          </span>
          <h1 className="text-xl font-semibold text-slate-900">Booking Rules</h1>
          <HelpAnchor topicId="policies-rules" label="Booking rules help" />
          <HelpAnchor topicId="deposit-rules" label="Deposit rules help" />
        </div>
        <p className="text-slate-600 text-sm">Configure deposit requirements and cancellation policies for reservations.</p>
      </div>

      {/* Info banner pointing to Forms page for legal documents */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900">Looking for legal documents and waivers?</p>
            <p className="text-sm text-blue-700 mt-1">
              Park rules, liability waivers, and other legal documents have moved to the Forms page for a better management experience.
            </p>
            <Link
              href="/forms"
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 mt-2"
            >
              Go to Forms & Documents
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {campgroundQuery.isLoading ? (
        <div className="p-12 text-center text-slate-500">Loading settings...</div>
      ) : !campgroundId ? (
        <div className="p-12 text-center text-slate-500">Please select a campground to view settings.</div>
      ) : !campgroundQuery.data ? (
        <div className="p-12 text-center text-red-500">Failed to load campground settings.</div>
      ) : (
        <div className="space-y-4">
          {/* Deposit Settings */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-medium text-slate-900">Deposit Settings</h2>
            </div>
            <DepositSettingsForm
              campgroundId={campgroundId}
              initialRule={campgroundQuery.data.depositRule ?? ""}
              initialPercentage={campgroundQuery.data.depositPercentage ?? null}
              initialConfig={(campgroundQuery.data as { depositConfig?: DepositConfig | null }).depositConfig ?? null}
            />
          </div>

          {/* Cancellation Policy */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-amber-600" />
              <div>
                <h2 className="text-lg font-medium text-slate-900">Cancellation Policy</h2>
                <p className="text-sm text-slate-600">Define policy type, window, and fee for cancellations.</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Policy type</label>
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
                <label className="text-sm font-medium text-slate-900">Cancel window (hours before arrival)</label>
                <Input
                  type="number"
                  min={0}
                  value={policyForm.cancellationWindowHours}
                  onChange={(e) => setPolicyForm((f) => ({ ...f, cancellationWindowHours: e.target.value }))}
                  placeholder="48"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Fee type</label>
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
                <label className="text-sm font-medium text-slate-900">Fee flat (cents)</label>
                <Input
                  type="number"
                  min={0}
                  value={policyForm.cancellationFeeFlatCents}
                  onChange={(e) => setPolicyForm((f) => ({ ...f, cancellationFeeFlatCents: e.target.value }))}
                  placeholder="2500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Fee percent (0-100)</label>
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
              <label className="text-sm font-medium text-slate-900">Notes</label>
              <Textarea
                rows={3}
                value={policyForm.cancellationNotes}
                onChange={(e) => setPolicyForm((f) => ({ ...f, cancellationNotes: e.target.value }))}
                placeholder="Additional details shown to staff/guests"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => savePolicyMutation.mutate()} disabled={savePolicyMutation.isPending}>
                {savePolicyMutation.isPending ? "Saving..." : "Save cancellation policy"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
