"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DepositSettingsForm } from "../../../../components/settings/DepositSettingsForm";
import { apiClient } from "../../../../lib/api-client";
import { HelpAnchor } from "@/components/help/HelpAnchor";
import { Input } from "../../../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import { Textarea } from "../../../../components/ui/textarea";
import { Button } from "../../../../components/ui/button";
import { useToast } from "../../../../components/ui/use-toast";
import { Pencil, Plus, Trash2 } from "lucide-react";

type PolicyTemplate = {
  id: string;
  campgroundId: string;
  name: string;
  description?: string | null;
  content?: string;
  type?: string;
  version?: number;
  isActive: boolean;
  autoSend: boolean;
  siteClassId?: string | null;
  siteId?: string | null;
  policyConfig?: Record<string, any> | null;
};

type PolicyTemplateForm = {
  name: string;
  description: string;
  content: string;
  type: string;
  version: string;
  isActive: boolean;
  autoSend: boolean;
  showDuringBooking: boolean;
  requireSignature: boolean;
  enforcement: string;
  deliveryChannel: string;
  reminderCadenceDays: string;
  reminderMaxCount: string;
  expiresAfterDays: string;
  signerRequirement: string;
  enforceOnChannels: string;
  siteClassId: string;
  siteId: string;
  minNights: string;
  maxNights: string;
  siteTypes: string;
  petTypes: string;
  rulesJson: string;
};

const defaultTemplateForm: PolicyTemplateForm = {
  name: "",
  description: "",
  content: "",
  type: "other",
  version: "1",
  isActive: true,
  autoSend: false,
  showDuringBooking: true,
  requireSignature: true,
  enforcement: "post_booking",
  deliveryChannel: "email",
  reminderCadenceDays: "7",
  reminderMaxCount: "8",
  expiresAfterDays: "30",
  signerRequirement: "primary_guest",
  enforceOnChannels: "",
  siteClassId: "",
  siteId: "",
  minNights: "",
  maxNights: "",
  siteTypes: "",
  petTypes: "",
  rulesJson: ""
};

export default function PoliciesPage() {
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [policyForm, setPolicyForm] = useState({
    cancellationPolicyType: "",
    cancellationWindowHours: "",
    cancellationFeeType: "",
    cancellationFeeFlatCents: "",
    cancellationFeePercent: "",
    cancellationNotes: "",
  });
  const [templateForm, setTemplateForm] = useState<PolicyTemplateForm>(defaultTemplateForm);
  const [editingTemplate, setEditingTemplate] = useState<PolicyTemplate | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateSaving, setTemplateSaving] = useState(false);
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
  const policyTemplatesQuery = useQuery({
    queryKey: ["policy-templates", campgroundId],
    queryFn: () => apiClient.getPolicyTemplates(campgroundId!),
    enabled: !!campgroundId,
  });
  const siteClassesQuery = useQuery({
    queryKey: ["site-classes", campgroundId],
    queryFn: () => apiClient.getSiteClasses(campgroundId!),
    enabled: !!campgroundId,
  });
  const sitesQuery = useQuery({
    queryKey: ["sites", campgroundId],
    queryFn: () => apiClient.getSites(campgroundId!),
    enabled: !!campgroundId,
  });

  useEffect(() => {
    const cg: any = campgroundQuery.data;
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
      toast({ title: "Policies updated" });
    },
    onError: () => toast({ title: "Failed to update policies", variant: "destructive" }),
  });

  const parseNumber = (value: string) => {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  const parseCommaList = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const closeTemplateModal = () => {
    setIsTemplateModalOpen(false);
    setEditingTemplate(null);
    setTemplateForm(defaultTemplateForm);
    setTemplateError(null);
    setTemplateSaving(false);
  };

  const openTemplateModal = () => {
    setEditingTemplate(null);
    setTemplateForm(defaultTemplateForm);
    setTemplateError(null);
    setIsTemplateModalOpen(true);
  };

  const openEditTemplate = (template: PolicyTemplate) => {
    const config = (template.policyConfig ?? {}) as Record<string, any>;
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name ?? "",
      description: template.description ?? "",
      content: template.content ?? "",
      type: template.type ?? "other",
      version: String(template.version ?? 1),
      isActive: template.isActive ?? true,
      autoSend: config.autoSend ?? template.autoSend ?? false,
      showDuringBooking: config.showDuringBooking ?? true,
      requireSignature: config.requireSignature ?? true,
      enforcement: config.enforcement ?? "post_booking",
      deliveryChannel: config.deliveryChannel ?? "email",
      reminderCadenceDays: config.reminderCadenceDays !== undefined ? String(config.reminderCadenceDays) : "7",
      reminderMaxCount: config.reminderMaxCount !== undefined ? String(config.reminderMaxCount) : "8",
      expiresAfterDays: config.expiresAfterDays !== undefined ? String(config.expiresAfterDays) : "30",
      signerRequirement: config.signerRequirement ?? "primary_guest",
      enforceOnChannels: Array.isArray(config.enforceOnChannels) ? config.enforceOnChannels.join(", ") : "",
      siteClassId: template.siteClassId ?? "",
      siteId: template.siteId ?? "",
      minNights: typeof config.minNights === "number" ? String(config.minNights) : "",
      maxNights: typeof config.maxNights === "number" ? String(config.maxNights) : "",
      siteTypes: Array.isArray(config.siteTypes) ? config.siteTypes.join(", ") : "",
      petTypes: Array.isArray(config.petTypes) ? config.petTypes.join(", ") : "",
      rulesJson: config.rules ? JSON.stringify(config.rules, null, 2) : ""
    });
    setTemplateError(null);
    setIsTemplateModalOpen(true);
  };

  const createTemplateMutation = useMutation({
    mutationFn: (data: Parameters<typeof apiClient.createPolicyTemplate>[1]) =>
      apiClient.createPolicyTemplate(campgroundId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policy-templates", campgroundId] });
      toast({ title: "Policy template saved" });
      closeTemplateModal();
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof apiClient.updatePolicyTemplate>[1] }) =>
      apiClient.updatePolicyTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policy-templates", campgroundId] });
      toast({ title: "Policy template updated" });
      closeTemplateModal();
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => apiClient.deletePolicyTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policy-templates", campgroundId] });
      toast({ title: "Policy template deleted" });
    },
  });

  const handleTemplateSubmit = async () => {
    if (!templateForm.name.trim()) {
      setTemplateError("Policy name is required.");
      return;
    }

    let rules: any = undefined;
    if (templateForm.rulesJson.trim()) {
      try {
        rules = JSON.parse(templateForm.rulesJson);
      } catch {
        setTemplateError("Rules JSON is invalid.");
        return;
      }
    }

    const enforceOnChannels = parseCommaList(templateForm.enforceOnChannels);
    const siteTypes = parseCommaList(templateForm.siteTypes);
    const petTypes = parseCommaList(templateForm.petTypes);

    const policyConfig: Record<string, any> = {
      enforcement: templateForm.enforcement || "post_booking",
      showDuringBooking: templateForm.showDuringBooking,
      requireSignature: templateForm.requireSignature,
      autoSend: templateForm.autoSend,
      deliveryChannel: templateForm.deliveryChannel || "email",
      reminderCadenceDays: parseNumber(templateForm.reminderCadenceDays),
      reminderMaxCount: parseNumber(templateForm.reminderMaxCount),
      expiresAfterDays: parseNumber(templateForm.expiresAfterDays),
      signerRequirement: templateForm.signerRequirement || undefined,
      minNights: parseNumber(templateForm.minNights),
      maxNights: parseNumber(templateForm.maxNights)
    };

    if (enforceOnChannels.length) policyConfig.enforceOnChannels = enforceOnChannels;
    if (siteTypes.length) policyConfig.siteTypes = siteTypes;
    if (petTypes.length) policyConfig.petTypes = petTypes;
    if (rules !== undefined) policyConfig.rules = rules;

    const parsedVersion = parseNumber(templateForm.version) ?? 1;

    const payload = {
      name: templateForm.name.trim(),
      description: templateForm.description.trim() || null,
      content: templateForm.content ?? "",
      type: templateForm.type || "other",
      version: parsedVersion,
      isActive: templateForm.isActive,
      autoSend: templateForm.autoSend,
      siteClassId: templateForm.siteClassId || null,
      siteId: templateForm.siteId || null,
      policyConfig
    };

    setTemplateSaving(true);
    setTemplateError(null);

    try {
      if (editingTemplate) {
        await updateTemplateMutation.mutateAsync({ id: editingTemplate.id, data: payload });
      } else {
        await createTemplateMutation.mutateAsync(payload);
      }
    } catch (err: any) {
      setTemplateError(err.message || "Failed to save policy template.");
      setTemplateSaving(false);
    }
  };

  const handleTemplateDelete = async (id: string) => {
    if (!confirm("Delete this policy template?")) return;
    await deleteTemplateMutation.mutateAsync(id);
  };

  const getSiteClassLabel = (id: string | null | undefined) => {
    if (!id) return "All site classes";
    const match = siteClassesQuery.data?.find((sc: any) => sc.id === id);
    return match?.name || id;
  };

  const getSiteLabel = (id: string | null | undefined) => {
    if (!id) return "All sites";
    const match = sitesQuery.data?.find((site: any) => site.id === id);
    const label = [match?.name, match?.siteNumber].filter(Boolean).join(" ");
    return label || id;
  };

  return (
    <div className="space-y-6">
        <div className="card p-6 space-y-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">Policies</h1>
            <HelpAnchor topicId="policies-rules" label="Policies help" />
            <HelpAnchor topicId="deposit-rules" label="Deposit rules help" />
          </div>
          <p className="text-slate-600 text-sm">Cancellations, deposits, house rules, and park guidelines.</p>
        </div>

        {campgroundQuery.isLoading ? (
          <div className="p-12 text-center text-slate-500">Loading settings...</div>
        ) : !campgroundId ? (
          <div className="p-12 text-center text-slate-500">Please select a campground to view settings.</div>
        ) : !campgroundQuery.data ? (
          <div className="p-12 text-center text-red-500">Failed to load campground settings.</div>
        ) : (
          <div className="space-y-4">
            <div className="card p-6">
              <h2 className="text-lg font-medium text-slate-900 mb-4">Deposit Settings</h2>
              <DepositSettingsForm
                campgroundId={campgroundId}
                initialRule={campgroundQuery.data.depositRule ?? ""}
                initialPercentage={campgroundQuery.data.depositPercentage ?? null}
                initialConfig={(campgroundQuery.data as any).depositConfig ?? null}
              />
            </div>

            <div className="card p-6 space-y-4">
              <div>
                <h2 className="text-lg font-medium text-slate-900">Cancellation policy</h2>
                <p className="text-sm text-slate-600">Define policy type, window, and fee for cancellations.</p>
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
                  {savePolicyMutation.isPending ? "Saving..." : "Save policy"}
                </Button>
              </div>
            </div>

            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium text-slate-900">Policy templates</h2>
                  <p className="text-sm text-slate-600">Create rules, signatures, reminders, and enforcement per policy.</p>
                </div>
                <Button onClick={openTemplateModal}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add policy
                </Button>
              </div>

              {policyTemplatesQuery.isLoading ? (
                <div className="text-sm text-slate-500">Loading policies...</div>
              ) : policyTemplatesQuery.data?.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                  <div className="font-medium text-slate-700">No policy templates yet</div>
                  <div className="mt-1">Create policies to control rules, signatures, and reminders.</div>
                  <Button className="mt-4" onClick={openTemplateModal}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create first policy
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {policyTemplatesQuery.data?.map((template: PolicyTemplate) => {
                    const config = (template.policyConfig ?? {}) as Record<string, any>;
                    const enforcement = config.enforcement ?? "post_booking";
                    const showDuringBooking = config.showDuringBooking ?? true;
                    const requireSignature = config.requireSignature ?? true;
                    const autoSend = config.autoSend ?? template.autoSend ?? false;
                    const enforcementLabel =
                      enforcement === "pre_booking"
                        ? "Required before booking"
                        : enforcement === "pre_checkin"
                          ? "Required before check-in"
                          : enforcement === "post_booking"
                            ? "Sent after booking"
                            : "Information only";
                    const scopeLabel = template.siteId
                      ? `Site: ${getSiteLabel(template.siteId)}`
                      : template.siteClassId
                        ? `Site class: ${getSiteClassLabel(template.siteClassId)}`
                        : "All sites";
                    return (
                      <div
                        key={template.id}
                        className={`rounded-lg border p-4 ${template.isActive ? "bg-white" : "bg-slate-50 opacity-70"}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-slate-900">{template.name}</h3>
                              {!template.isActive && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                  Inactive
                                </span>
                              )}
                            </div>
                            {template.description && (
                              <p className="text-sm text-slate-600">{template.description}</p>
                            )}
                            <div className="text-xs text-slate-500">
                              {scopeLabel} • {enforcementLabel} • {requireSignature ? "Signature required" : "Acknowledgement only"} • {autoSend ? "Auto-send" : "Manual send"}
                            </div>
                            <div className="text-xs text-slate-500">
                              {showDuringBooking ? "Shown during booking" : "Hidden during booking"} • Type: {template.type || "other"} • v{template.version ?? 1}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEditTemplate(template)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTemplateDelete(template.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              {editingTemplate ? "Edit Policy Template" : "Create Policy Template"}
            </h2>

            {templateError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {templateError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-900">Policy name *</label>
                <Input
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Pet policy"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900">Description</label>
                <Textarea
                  rows={2}
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Short summary shown to staff/guests"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900">Policy content</label>
                <Textarea
                  rows={6}
                  value={templateForm.content}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, content: e.target.value }))}
                  placeholder="Full policy text shown during booking and signing"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900">Document type</label>
                  <select
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    value={templateForm.type}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="long_term_stay">Long-term stay</option>
                    <option value="park_rules">Park rules</option>
                    <option value="deposit">Deposit/fees</option>
                    <option value="waiver">Waiver</option>
                    <option value="coi">COI acknowledgement</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900">Version</label>
                  <Input
                    type="number"
                    min={1}
                    value={templateForm.version}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, version: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900">Enforcement</label>
                  <select
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    value={templateForm.enforcement}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, enforcement: e.target.value }))}
                  >
                    <option value="post_booking">Post booking (default)</option>
                    <option value="pre_booking">Pre booking (block booking)</option>
                    <option value="pre_checkin">Pre check-in</option>
                    <option value="none">Informational only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900">Delivery channel</label>
                  <select
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    value={templateForm.deliveryChannel}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, deliveryChannel: e.target.value }))}
                  >
                    <option value="email">Email</option>
                    <option value="email_and_sms">Email + SMS fallback</option>
                    <option value="sms">SMS only</option>
                  </select>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900">Reminder cadence (days)</label>
                  <Input
                    type="number"
                    min={0}
                    value={templateForm.reminderCadenceDays}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, reminderCadenceDays: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900">Max reminders</label>
                  <Input
                    type="number"
                    min={0}
                    value={templateForm.reminderMaxCount}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, reminderMaxCount: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900">Expires after (days)</label>
                  <Input
                    type="number"
                    min={0}
                    value={templateForm.expiresAfterDays}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, expiresAfterDays: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900">Signer requirement</label>
                  <Input
                    value={templateForm.signerRequirement}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, signerRequirement: e.target.value }))}
                    placeholder="primary_guest"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900">Enforce on channels</label>
                  <Input
                    value={templateForm.enforceOnChannels}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, enforceOnChannels: e.target.value }))}
                    placeholder="online, front_desk"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900">Site class</label>
                  <select
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    value={templateForm.siteClassId}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, siteClassId: e.target.value }))}
                  >
                    <option value="">All site classes</option>
                    {siteClassesQuery.data?.map((siteClass: any) => (
                      <option key={siteClass.id} value={siteClass.id}>{siteClass.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900">Site</label>
                  <select
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    value={templateForm.siteId}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, siteId: e.target.value }))}
                  >
                    <option value="">All sites</option>
                    {sitesQuery.data?.map((site: any) => (
                      <option key={site.id} value={site.id}>
                        {site.name || site.siteNumber || site.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900">Min nights</label>
                  <Input
                    type="number"
                    min={0}
                    value={templateForm.minNights}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, minNights: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900">Max nights</label>
                  <Input
                    type="number"
                    min={0}
                    value={templateForm.maxNights}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, maxNights: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900">Site types</label>
                  <Input
                    value={templateForm.siteTypes}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, siteTypes: e.target.value }))}
                    placeholder="rv, tent, cabin"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900">Pet types</label>
                  <Input
                    value={templateForm.petTypes}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, petTypes: e.target.value }))}
                    placeholder="dog, cat"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900">Rules JSON (advanced)</label>
                <Textarea
                  rows={5}
                  value={templateForm.rulesJson}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, rulesJson: e.target.value }))}
                  placeholder='[{"field":"guest.petCount","op":"gt","value":0}]'
                />
                <p className="text-xs text-slate-500 mt-1">
                  Optional: define rule groups and advanced fields. Leave blank to apply defaults.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={templateForm.isActive}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={templateForm.autoSend}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, autoSend: e.target.checked }))}
                  />
                  Auto-send signature
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={templateForm.showDuringBooking}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, showDuringBooking: e.target.checked }))}
                  />
                  Show during booking
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={templateForm.requireSignature}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, requireSignature: e.target.checked }))}
                  />
                  Require signature
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={closeTemplateModal} disabled={templateSaving}>
                Cancel
              </Button>
              <Button onClick={handleTemplateSubmit} disabled={templateSaving}>
                {templateSaving ? "Saving..." : editingTemplate ? "Save changes" : "Create policy"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
