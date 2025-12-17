"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { FormField } from "@/components/ui/form-field";
import { FormTextarea } from "@/components/ui/form-textarea";
import { apiClient } from "@/lib/api-client";

interface Template {
  id: string;
  campgroundId: string;
  name: string;
  channel: "email" | "sms" | "both";
  category: string | null;
  subject: string | null;
  html: string | null;
  textBody: string | null;
  createdAt: string;
  updatedAt: string;
}

const TEMPLATE_VARIABLES = [
  { key: "{{guest_name}}", desc: "Guest's full name" },
  { key: "{{campground_name}}", desc: "Campground name" },
  { key: "{{site_number}}", desc: "Site number" },
  { key: "{{arrival_date}}", desc: "Check-in date" },
  { key: "{{departure_date}}", desc: "Check-out date" },
  { key: "{{amount}}", desc: "Payment amount" },
  { key: "{{reservation_id}}", desc: "Reservation ID" },
  { key: "{{balance_due}}", desc: "Outstanding balance" },
];

const CATEGORIES = [
  "booking",
  "payment",
  "reminder",
  "confirmation",
  "marketing",
  "operational",
  "general",
];

const PREBUILT_TEMPLATES = [
  {
    name: "Booking Confirmation",
    category: "confirmation",
    channel: "email" as const,
    subject: "Your reservation at {{campground_name}} is confirmed!",
    html: `<h1>Hi {{guest_name}}!</h1>
<p>Great news! Your reservation has been confirmed.</p>
<p><strong>Reservation Details:</strong></p>
<ul>
  <li>Site: {{site_number}}</li>
  <li>Check-in: {{arrival_date}}</li>
  <li>Check-out: {{departure_date}}</li>
  <li>Confirmation #: {{reservation_id}}</li>
</ul>
<p>We can't wait to welcome you!</p>
<p>— The {{campground_name}} Team</p>`,
    textBody: null,
  },
  {
    name: "Booking Reminder (3 Days)",
    category: "reminder",
    channel: "email" as const,
    subject: "Your camping trip is almost here!",
    html: `<h1>Hey {{guest_name}}!</h1>
<p>Your adventure at {{campground_name}} starts in just 3 days!</p>
<p><strong>Quick reminder:</strong></p>
<ul>
  <li>Site: {{site_number}}</li>
  <li>Arrival: {{arrival_date}}</li>
  <li>Departure: {{departure_date}}</li>
</ul>
<p>Don't forget to pack the s'mores supplies! 🏕️</p>`,
    textBody: null,
  },
  {
    name: "Check-In Reminder",
    category: "reminder",
    channel: "sms" as const,
    subject: null,
    html: null,
    textBody: "Hi {{guest_name}}! Your check-in at {{campground_name}} is today. Site {{site_number}} is ready for you. See you soon!",
  },
  {
    name: "Payment Received",
    category: "payment",
    channel: "email" as const,
    subject: "Payment received - Thank you!",
    html: `<h1>Payment Confirmed</h1>
<p>Hi {{guest_name}},</p>
<p>We've received your payment of {{amount}}.</p>
<p><strong>Reservation:</strong> {{reservation_id}}<br/>
<strong>Remaining balance:</strong> {{balance_due}}</p>
<p>Thank you for choosing {{campground_name}}!</p>`,
    textBody: null,
  },
  {
    name: "Payment Due Reminder",
    category: "payment",
    channel: "email" as const,
    subject: "Friendly reminder: Balance due for your upcoming stay",
    html: `<h1>Balance Reminder</h1>
<p>Hi {{guest_name}},</p>
<p>Just a friendly reminder that you have an outstanding balance of <strong>{{balance_due}}</strong> for your reservation at {{campground_name}}.</p>
<p><strong>Reservation:</strong> {{reservation_id}}<br/>
<strong>Arrival:</strong> {{arrival_date}}</p>
<p>Please complete your payment to secure your site.</p>`,
    textBody: null,
  },
  {
    name: "Check-Out Thank You",
    category: "confirmation",
    channel: "email" as const,
    subject: "Thanks for staying with us!",
    html: `<h1>Thanks for visiting, {{guest_name}}!</h1>
<p>We hope you had an amazing time at {{campground_name}}!</p>
<p>We'd love to hear about your experience. If you have a moment, please leave us a review.</p>
<p>Safe travels, and we hope to see you again soon! 🌲</p>`,
    textBody: null,
  },
  {
    name: "Cancellation Confirmation",
    category: "booking",
    channel: "email" as const,
    subject: "Your reservation has been cancelled",
    html: `<h1>Reservation Cancelled</h1>
<p>Hi {{guest_name}},</p>
<p>Your reservation ({{reservation_id}}) at {{campground_name}} has been cancelled as requested.</p>
<p>If this was a mistake or you'd like to rebook, please contact us.</p>
<p>We hope to host you another time!</p>`,
    textBody: null,
  },
  {
    name: "Welcome SMS",
    category: "operational",
    channel: "sms" as const,
    subject: null,
    html: null,
    textBody: "Welcome to {{campground_name}}, {{guest_name}}! Your site {{site_number}} is ready. Office hours: 8am-8pm. Enjoy your stay!",
  },
  {
    name: "Seasonal Promotion",
    category: "marketing",
    channel: "email" as const,
    subject: "Special offer just for you! 🏕️",
    html: `<h1>{{guest_name}}, we miss you!</h1>
<p>It's been a while since your last visit to {{campground_name}}.</p>
<p>Book your next adventure and enjoy exclusive returning guest rates!</p>
<p>Use code <strong>WELCOME10</strong> for 10% off your next stay.</p>
<p>See you soon under the stars! ⭐</p>`,
    textBody: null,
  },
  {
    name: "Weather Alert",
    category: "operational",
    channel: "sms" as const,
    subject: null,
    html: null,
    textBody: "{{campground_name}} Alert: Weather advisory in effect. Please secure loose items and check in at the office if you need assistance.",
  },
];

// Form types
type CreateTemplateFormData = {
  name: string;
  channel: "email" | "sms";
  category: string;
};

type TemplateEditorFormData = {
  name: string;
  subject: string;
  html: string;
  textBody: string;
};

export default function TemplatesPage() {
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setCampgroundId(stored);
  }, []);

  const templatesQuery = useQuery({
    queryKey: ["campaign-templates", campgroundId],
    queryFn: () => apiClient.getCampaignTemplates(campgroundId!),
    enabled: !!campgroundId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteCampaignTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-templates"] });
      setSelectedTemplate(null);
    },
  });

  const templates = templatesQuery.data ?? [];

  // Group by category
  const templatesByCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = templates.filter((t: Template) => (t.category || "general") === cat);
    return acc;
  }, {} as Record<string, Template[]>);

  if (!campgroundId) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-500">Select a campground to manage templates</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="p-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Email & SMS Templates</h1>
            <p className="text-slate-500 mt-1">Create and manage notification templates</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition-colors flex items-center gap-2"
          >
            <span>+</span> New Template
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Templates List */}
          <div className="lg:col-span-1 space-y-4">
            {templatesQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-600" />
              </div>
            ) : templates.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <div className="text-4xl mb-3">📧</div>
                <p className="text-slate-500">No templates yet</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 text-violet-600 hover:text-violet-700 text-sm font-medium"
                >
                  Create your first template →
                </button>
              </div>
            ) : (
              CATEGORIES.map(cat => {
                const catTemplates = templatesByCategory[cat];
                if (catTemplates.length === 0) return null;
                return (
                  <div key={cat} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                      <h3 className="font-medium text-slate-700 capitalize">{cat}</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {catTemplates.map((template: Template) => (
                        <button
                          key={template.id}
                          onClick={() => setSelectedTemplate(template)}
                          className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors ${selectedTemplate?.id === template.id ? "bg-violet-50 border-l-2 border-violet-500" : ""
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-slate-900">{template.name}</div>
                              <div className="text-xs text-slate-500">
                                {template.channel === "email" ? "📧" : "📱"} {template.channel}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Template Editor */}
          <div className="lg:col-span-2">
            {selectedTemplate ? (
              <TemplateEditor
                template={selectedTemplate}
                onSave={() => {
                  queryClient.invalidateQueries({ queryKey: ["campaign-templates"] });
                }}
                onDelete={() => {
                  if (confirm("Delete this template?")) {
                    deleteMutation.mutate(selectedTemplate.id);
                  }
                }}
                previewMode={previewMode}
                onTogglePreview={() => setPreviewMode(!previewMode)}
              />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 h-[500px] flex items-center justify-center">
                <div className="text-center text-slate-400">
                  <div className="text-4xl mb-3">✨</div>
                  <p>Select a template to edit</p>
                </div>
              </div>
            )}

            {/* Variables Reference */}
            <div className="mt-6 bg-white rounded-xl border border-slate-200 p-4">
              <h4 className="font-medium text-slate-800 mb-3">Available Variables</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {TEMPLATE_VARIABLES.map(v => (
                  <div
                    key={v.key}
                    className="px-2 py-1 bg-slate-50 rounded text-xs cursor-pointer hover:bg-slate-100"
                    onClick={() => navigator.clipboard.writeText(v.key)}
                    title={`Click to copy: ${v.key}`}
                  >
                    <code className="text-violet-600">{v.key}</code>
                    <div className="text-slate-500 text-[10px]">{v.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Prebuilt Templates Gallery */}
        <PrebuiltTemplatesGallery
          campgroundId={campgroundId}
          existingTemplateNames={templates.map((t: Template) => t.name)}
          onTemplateAdded={() => {
            queryClient.invalidateQueries({ queryKey: ["campaign-templates"] });
          }}
        />

        {/* Create Modal */}
        {showCreateModal && (
          <CreateTemplateModal
            campgroundId={campgroundId}
            onClose={() => setShowCreateModal(false)}
            onCreated={(template) => {
              setShowCreateModal(false);
              setSelectedTemplate(template);
              queryClient.invalidateQueries({ queryKey: ["campaign-templates"] });
            }}
          />
        )}
      </div>
    </DashboardShell>
  );
}

function TemplateEditor({
  template,
  onSave,
  onDelete,
  previewMode,
  onTogglePreview,
}: {
  template: Template;
  onSave: () => void;
  onDelete: () => void;
  previewMode: boolean;
  onTogglePreview: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
  } = useForm<TemplateEditorFormData>({
    defaultValues: {
      name: template.name,
      subject: template.subject ?? "",
      html: template.html ?? "",
      textBody: template.textBody ?? "",
    },
    mode: "onChange",
  });

  const formData = watch();

  useEffect(() => {
    reset({
      name: template.name,
      subject: template.subject ?? "",
      html: template.html ?? "",
      textBody: template.textBody ?? "",
    });
  }, [template, reset]);

  const onSubmit = async (data: any) => {
    try {
      await apiClient.updateCampaignTemplate(template.id, {
        name: data.name,
        subject: data.subject || undefined,
        html: data.html || undefined,
        textBody: data.textBody || undefined,
      });
      onSave();
    } catch (err) {
      console.error("Failed to save template:", err);
    }
  };

  // Preview with sample data
  const previewHtml = (formData.html || "")
    .replace(/\{\{guest_name\}\}/g, "John Smith")
    .replace(/\{\{campground_name\}\}/g, "Pine Valley Campground")
    .replace(/\{\{site_number\}\}/g, "A-15")
    .replace(/\{\{arrival_date\}\}/g, "Dec 15, 2024")
    .replace(/\{\{departure_date\}\}/g, "Dec 18, 2024")
    .replace(/\{\{amount\}\}/g, "$150.00")
    .replace(/\{\{reservation_id\}\}/g, "RES-12345")
    .replace(/\{\{balance_due\}\}/g, "$50.00");

  const previewText = (formData.textBody || "")
    .replace(/\{\{guest_name\}\}/g, "John Smith")
    .replace(/\{\{campground_name\}\}/g, "Pine Valley")
    .replace(/\{\{site_number\}\}/g, "A-15");

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg">{template.channel === "email" ? "📧" : "📱"}</span>
          <input
            type="text"
            {...register("name")}
            className="font-semibold text-slate-900 bg-transparent border-none outline-none focus:ring-0 text-lg"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePreview}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${previewMode ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"
              }`}
          >
            {previewMode ? "Edit" : "Preview"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={!isDirty}
            className="px-4 py-1.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      {/* Content */}
      <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
        {errors.name && (
          <p className="text-sm text-red-600">{errors.name.message}</p>
        )}

        {template.channel === "email" && (
          <FormField
            label="Subject Line"
            placeholder="Email subject..."
            error={errors.subject?.message}
            showSuccess
            {...register("subject")}
          />
        )}

        {previewMode ? (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 text-sm text-slate-600">
              Preview (with sample data)
            </div>
            {template.channel === "email" ? (
              <div
                className="p-4 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <div className="p-4 bg-slate-900 text-white font-mono text-sm whitespace-pre-wrap">
                {previewText}
              </div>
            )}
          </div>
        ) : (
          <>
            {template.channel === "email" ? (
              <FormTextarea
                label="HTML Content"
                rows={15}
                placeholder="<h1>Hello {{guest_name}}</h1>..."
                error={errors.html?.message}
                showSuccess
                className="font-mono text-sm"
                {...register("html")}
              />
            ) : (
              <FormTextarea
                label={`SMS Text (${(formData.textBody || "").length}/160 chars)`}
                rows={4}
                maxLength={160}
                placeholder="Your reservation at {{campground_name}} is confirmed..."
                error={errors.textBody?.message}
                showSuccess
                {...register("textBody")}
              />
            )}
          </>
        )}
      </form>
    </div>
  );
}

function CreateTemplateModal({
  campgroundId,
  onClose,
  onCreated,
}: {
  campgroundId: string;
  onClose: () => void;
  onCreated: (template: Template) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<CreateTemplateFormData>({
    defaultValues: {
      name: "",
      channel: "email",
      category: "general",
    },
    mode: "onChange",
  });

  const channel = watch("channel");

  const onSubmit = async (data: CreateTemplateFormData) => {
    try {
      const result = await apiClient.createCampaignTemplate(campgroundId, {
        name: data.name,
        channel: data.channel,
        category: data.category,
        subject: data.channel === "email" ? "New Template" : undefined,
        html: data.channel === "email" ? "<p>Hello {{guest_name}},</p>" : undefined,
        textBody: data.channel === "sms" ? "Hello {{guest_name}}!" : undefined,
      });
      onCreated(result as Template);
    } catch (err) {
      console.error("Failed to create template:", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900">New Template</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            label="Template Name *"
            placeholder="Booking Confirmation"
            error={errors.name?.message}
            showSuccess
            {...register("name")}
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Channel</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setValue("channel", "email", { shouldValidate: true })}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${channel === "email"
                  ? "bg-violet-100 text-violet-700 border-2 border-violet-300"
                  : "bg-slate-50 text-slate-600 border border-slate-200"
                  }`}
              >
                📧 Email
              </button>
              <button
                type="button"
                onClick={() => setValue("channel", "sms", { shouldValidate: true })}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${channel === "sms"
                  ? "bg-violet-100 text-violet-700 border-2 border-violet-300"
                  : "bg-slate-50 text-slate-600 border border-slate-200"
                  }`}
              >
                📱 SMS
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              {...register("category")}
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat} className="capitalize">{cat}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!watch("name")?.trim()}
              className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
            >
              Create Template
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PrebuiltTemplatesGallery({
  campgroundId,
  existingTemplateNames,
  onTemplateAdded,
}: {
  campgroundId: string;
  existingTemplateNames: string[];
  onTemplateAdded: () => void;
}) {
  const [addingTemplate, setAddingTemplate] = useState<string | null>(null);

  const handleAddTemplate = async (template: typeof PREBUILT_TEMPLATES[0]) => {
    setAddingTemplate(template.name);
    try {
      await apiClient.createCampaignTemplate(campgroundId, {
        name: template.name,
        channel: template.channel,
        category: template.category,
        subject: template.subject || undefined,
        html: template.html || undefined,
        textBody: template.textBody || undefined,
      });
      onTemplateAdded();
    } catch (err) {
      console.error("Failed to add prebuilt template:", err);
    } finally {
      setAddingTemplate(null);
    }
  };

  const alreadyAdded = (name: string) => existingTemplateNames.includes(name);

  return (
    <div className="mt-8 bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">📋 Prebuilt Templates</h3>
          <p className="text-sm text-slate-500">One-click add common campground notification templates</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PREBUILT_TEMPLATES.map(template => {
          const added = alreadyAdded(template.name);
          const isAdding = addingTemplate === template.name;

          return (
            <div
              key={template.name}
              className={`border rounded-lg p-4 transition-all ${added
                  ? "bg-slate-50 border-slate-200 opacity-60"
                  : "bg-white border-slate-200 hover:border-violet-300 hover:shadow-sm"
                }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{template.channel === "email" ? "📧" : "📱"}</span>
                  <span className="font-medium text-slate-900 text-sm">{template.name}</span>
                </div>
                <span className="text-[10px] uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  {template.category}
                </span>
              </div>

              <p className="text-xs text-slate-500 mb-3 line-clamp-2">
                {template.channel === "email"
                  ? template.subject
                  : template.textBody?.slice(0, 60) + "..."}
              </p>

              {added ? (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  ✓ Already added
                </span>
              ) : (
                <button
                  onClick={() => handleAddTemplate(template)}
                  disabled={isAdding}
                  className="w-full px-3 py-1.5 text-xs font-medium text-violet-600 bg-violet-50 rounded-lg hover:bg-violet-100 transition-colors disabled:opacity-50"
                >
                  {isAdding ? "Adding..." : "+ Add Template"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className="text-xs text-slate-400">
          💡 <strong>Tip:</strong> After adding a template, you can customize the content and attach it to notification triggers in Settings → Notification Triggers.
        </p>
      </div>
    </div>
  );
}
