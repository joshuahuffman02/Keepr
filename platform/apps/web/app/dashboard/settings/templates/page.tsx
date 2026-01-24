"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FormField } from "@/components/ui/form-field";

// DOMPurify requires browser DOM - lazy load only on client
let DOMPurify: { sanitize: (html: string) => string } | null = null;
if (typeof window !== "undefined") {
  DOMPurify = require("dompurify");
}
import { FormTextarea } from "@/components/ui/form-textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";
import {
  Mail,
  Smartphone,
  FileText,
  Lightbulb,
  Check,
  X,
  Sparkles,
  Plus,
  Zap,
  ArrowRight,
  Link as LinkIcon,
  ExternalLink,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Template = Awaited<ReturnType<typeof apiClient.createCampaignTemplate>>;
type PrebuiltTemplate = Omit<Template, "id" | "campgroundId" | "createdAt" | "updatedAt">;

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

// Improved prebuilt templates with better styling and content
const PREBUILT_TEMPLATES: PrebuiltTemplate[] = [
  {
    name: "Booking Confirmation",
    category: "confirmation",
    channel: "email",
    subject: "Confirmed! Your reservation at {{campground_name}}",
    html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%); color: white; padding: 32px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #ffffff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; }
    .details-box { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #64748b; font-size: 14px; }
    .detail-value { font-weight: 600; color: #1e293b; }
    .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
    .button { display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Reservation Confirmed!</h1>
    </div>
    <div class="content">
      <p>Hi {{guest_name}},</p>
      <p>Great news! Your camping adventure is officially booked. We're excited to host you!</p>

      <div class="details-box">
        <div class="detail-row">
          <span class="detail-label">Site</span>
          <span class="detail-value">{{site_number}}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Check-in</span>
          <span class="detail-value">{{arrival_date}}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Check-out</span>
          <span class="detail-value">{{departure_date}}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Confirmation #</span>
          <span class="detail-value">{{reservation_id}}</span>
        </div>
      </div>

      <p>Need to make changes? Just reply to this email or give us a call.</p>
      <p>See you soon!</p>
      <p><strong>The {{campground_name}} Team</strong></p>
    </div>
    <div class="footer">
      {{campground_name}}
    </div>
  </div>
</body>
</html>`,
    textBody: null,
  },
  {
    name: "Check-in Reminder (24h)",
    category: "reminder",
    channel: "email",
    subject: "Tomorrow's the day! Your check-in details",
    html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 32px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #ffffff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; }
    .info-box { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .checklist { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .checklist h3 { margin-top: 0; color: #475569; }
    .checklist ul { margin: 0; padding-left: 20px; }
    .checklist li { padding: 4px 0; }
    .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your Adventure Awaits!</h1>
    </div>
    <div class="content">
      <p>Hey {{guest_name}}!</p>
      <p>Your camping trip at {{campground_name}} is just <strong>one day away</strong>!</p>

      <div class="info-box">
        <strong>Your Check-in Details:</strong><br>
        Site {{site_number}} on {{arrival_date}}<br>
        Check-in time: After 2:00 PM
      </div>

      <div class="checklist">
        <h3>Quick Packing Checklist:</h3>
        <ul>
          <li>Tent & sleeping gear</li>
          <li>Flashlight/lantern</li>
          <li>First aid kit</li>
          <li>Reservation confirmation</li>
          <li>Valid ID</li>
        </ul>
      </div>

      <p>Questions? Just reply to this email or call us.</p>
      <p>Safe travels!</p>
      <p><strong>The {{campground_name}} Team</strong></p>
    </div>
    <div class="footer">
      {{campground_name}}
    </div>
  </div>
</body>
</html>`,
    textBody: null,
  },
  {
    name: "Check-In SMS",
    category: "reminder",
    channel: "sms",
    subject: null,
    html: null,
    textBody:
      "Hi {{guest_name}}! Reminder: Your check-in at {{campground_name}} is today. Site {{site_number}} is ready. Check-in after 2pm. See you soon!",
  },
  {
    name: "Payment Received",
    category: "payment",
    channel: "email",
    subject: "Payment received - Thank you!",
    html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 32px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #ffffff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; }
    .amount-box { background: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
    .amount { font-size: 32px; font-weight: bold; color: #059669; }
    .details { background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Payment Confirmed</h1>
    </div>
    <div class="content">
      <p>Hi {{guest_name}},</p>
      <p>We've received your payment. Thank you!</p>

      <div class="amount-box">
        <div class="amount">{{amount}}</div>
        <div style="color: #64748b; font-size: 14px;">Payment received</div>
      </div>

      <div class="details">
        <strong>Reservation:</strong> {{reservation_id}}<br>
        <strong>Remaining balance:</strong> {{balance_due}}
      </div>

      <p>Thank you for choosing {{campground_name}}!</p>
    </div>
    <div class="footer">
      {{campground_name}}
    </div>
  </div>
</body>
</html>`,
    textBody: null,
  },
  {
    name: "Balance Due Reminder",
    category: "payment",
    channel: "email",
    subject: "Friendly reminder: Balance due for your stay",
    html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 32px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #ffffff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; }
    .balance-box { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
    .balance { font-size: 32px; font-weight: bold; color: #d97706; }
    .button { display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px; }
    .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Payment Reminder</h1>
    </div>
    <div class="content">
      <p>Hi {{guest_name}},</p>
      <p>Just a friendly reminder that you have an outstanding balance for your upcoming stay at {{campground_name}}.</p>

      <div class="balance-box">
        <div class="balance">{{balance_due}}</div>
        <div style="color: #64748b; font-size: 14px;">Balance due</div>
      </div>

      <p><strong>Reservation:</strong> {{reservation_id}}<br>
      <strong>Arrival:</strong> {{arrival_date}}</p>

      <p>Please complete your payment to secure your site. If you've already paid, please disregard this message.</p>

      <p>Questions? Just reply to this email.</p>
    </div>
    <div class="footer">
      {{campground_name}}
    </div>
  </div>
</body>
</html>`,
    textBody: null,
  },
  {
    name: "Check-Out Thank You",
    category: "confirmation",
    channel: "email",
    subject: "Thanks for staying with us, {{guest_name}}!",
    html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%); color: white; padding: 32px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #ffffff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; text-align: center; }
    .stars { font-size: 32px; margin: 20px 0; }
    .review-prompt { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .button { display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Thanks for Visiting!</h1>
    </div>
    <div class="content">
      <p>Hey {{guest_name}},</p>
      <p>We hope you had an amazing time at {{campground_name}}!</p>

      <div class="review-prompt">
        <p><strong>How was your stay?</strong></p>
        <p style="color: #64748b; font-size: 14px;">We'd love to hear about your experience. Your feedback helps us improve and helps other campers find their perfect spot.</p>
      </div>

      <p>We hope to see you again soon!</p>
      <p>Safe travels,</p>
      <p><strong>The {{campground_name}} Team</strong></p>
    </div>
    <div class="footer">
      {{campground_name}}
    </div>
  </div>
</body>
</html>`,
    textBody: null,
  },
  {
    name: "Cancellation Confirmation",
    category: "booking",
    channel: "email",
    subject: "Your reservation has been cancelled",
    html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #64748b; color: white; padding: 32px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #ffffff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; }
    .info-box { background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .button { display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Reservation Cancelled</h1>
    </div>
    <div class="content">
      <p>Hi {{guest_name}},</p>
      <p>Your reservation has been cancelled as requested.</p>

      <div class="info-box">
        <strong>Cancelled Reservation:</strong> {{reservation_id}}<br>
        <strong>Original Dates:</strong> {{arrival_date}} - {{departure_date}}
      </div>

      <p>If this was a mistake or you'd like to rebook, please contact us or visit our website.</p>
      <p>We hope to host you another time!</p>
      <p><strong>The {{campground_name}} Team</strong></p>
    </div>
    <div class="footer">
      {{campground_name}}
    </div>
  </div>
</body>
</html>`,
    textBody: null,
  },
  {
    name: "Welcome SMS",
    category: "operational",
    channel: "sms",
    subject: null,
    html: null,
    textBody:
      "Welcome to {{campground_name}}! Site {{site_number}} is ready for you. Office: 8am-8pm. WiFi password at the office. Enjoy your stay!",
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

// Success toast state
interface SuccessToast {
  message: string;
  templateName: string;
  show: boolean;
}

export default function TemplatesPage() {
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [successToast, setSuccessToast] = useState<SuccessToast | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const queryClient = useQueryClient();
  const templateListRef = useRef<HTMLDivElement>(null);
  const requireCampgroundId = () => {
    if (!campgroundId) {
      throw new Error("Campground is required");
    }
    return campgroundId;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setCampgroundId(stored);
  }, []);

  const templatesQuery = useQuery<Template[]>({
    queryKey: ["campaign-templates", campgroundId],
    queryFn: () => apiClient.getCampaignTemplates(requireCampgroundId()),
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
  const templatesByCategory = CATEGORIES.reduce<Record<string, Template[]>>((acc, cat) => {
    acc[cat] = templates.filter((template) => (template.category || "general") === cat);
    return acc;
  }, {});

  // Show success toast and auto-hide
  const showSuccessToast = (templateName: string) => {
    setSuccessToast({ message: "Template added!", templateName, show: true });
    setTimeout(() => {
      setSuccessToast(null);
    }, 5000);
  };

  // Handle template added from prebuilt gallery
  const handleTemplateAdded = (templateName: string) => {
    queryClient.invalidateQueries({ queryKey: ["campaign-templates"] });
    showSuccessToast(templateName);
    // Scroll the template list into view
    setTimeout(() => {
      templateListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
  };

  if (!campgroundId) {
    return (
      <div>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Select a campground to manage templates</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Success Toast */}
      {successToast?.show && (
        <div className="fixed top-4 right-4 z-50 motion-safe:animate-in motion-safe:slide-in-from-top-2 motion-safe:fade-in motion-safe:duration-300">
          <div className="bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <div className="p-1 bg-emerald-500 rounded-full">
              <Check className="h-4 w-4" />
            </div>
            <div>
              <div className="font-medium">{successToast.message}</div>
              <div className="text-sm text-emerald-100">
                "{successToast.templateName}" is ready to use
              </div>
            </div>
            <Link
              href="/dashboard/settings/notification-triggers"
              className="ml-4 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 rounded text-sm font-medium flex items-center gap-1 transition-colors"
            >
              <Zap className="h-3.5 w-3.5" /> Connect to Trigger
            </Link>
            <button
              onClick={() => setSuccessToast(null)}
              className="ml-2 text-emerald-200 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="p-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Email & SMS Templates</h1>
            <p className="text-muted-foreground mt-1">
              Create message templates, then connect them to triggers to automate sending
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-action-primary text-action-primary-foreground rounded-lg font-medium hover:bg-action-primary-hover transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> New Template
          </button>
        </div>

        {/* Workflow Hint */}
        <div className="bg-status-info/10 border border-status-info/20 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-card rounded-lg border border-border">
                <FileText className="h-5 w-5 text-status-info" />
              </div>
              <div>
                <div className="font-medium text-foreground">1. Create Template</div>
                <div className="text-muted-foreground">Design your message</div>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground/60" />
            <div className="flex items-center gap-2">
              <div className="p-2 bg-card rounded-lg border border-border">
                <LinkIcon className="h-5 w-5 text-status-info" />
              </div>
              <div>
                <div className="font-medium text-foreground">2. Connect to Trigger</div>
                <div className="text-muted-foreground">Choose when to send</div>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground/60" />
            <div className="flex items-center gap-2">
              <div className="p-2 bg-card rounded-lg border border-border">
                <Zap className="h-5 w-5 text-status-info" />
              </div>
              <div>
                <div className="font-medium text-foreground">3. Automatic!</div>
                <div className="text-muted-foreground">Guests get notified</div>
              </div>
            </div>
            <div className="ml-auto">
              <Link
                href="/dashboard/settings/notification-triggers"
                className="text-action-primary hover:text-action-primary-hover font-medium flex items-center gap-1"
              >
                Go to Triggers <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Templates List */}
          <div className="lg:col-span-1 space-y-4" ref={templateListRef}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Your Templates</h2>
              <span className="text-sm text-muted-foreground">{templates.length} total</span>
            </div>

            {templatesQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-action-primary" />
              </div>
            ) : templates.length === 0 ? (
              <div className="bg-status-info/10 rounded-2xl p-8 text-center border border-status-info/20">
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-status-info/15 rounded-full">
                    <Sparkles className="h-10 w-10 text-status-info" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">No Templates Yet</h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  Start by adding a prebuilt template below, or create a custom one from scratch.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-2.5 bg-action-primary text-action-primary-foreground rounded-lg font-medium
                    hover:bg-action-primary-hover active:scale-[0.98] transition-all
                    focus-visible:ring-2 focus-visible:ring-action-primary focus-visible:ring-offset-2"
                >
                  Create Template
                </button>
              </div>
            ) : (
              CATEGORIES.map((cat) => {
                const catTemplates = templatesByCategory[cat];
                if (catTemplates.length === 0) return null;
                return (
                  <div
                    key={cat}
                    className="bg-card rounded-xl border border-border overflow-hidden"
                  >
                    <div className="px-4 py-2 bg-muted border-b border-border">
                      <h3 className="font-medium text-foreground capitalize">{cat}</h3>
                    </div>
                    <div className="divide-y divide-border">
                      {catTemplates.map((template: Template) => (
                        <button
                          key={template.id}
                          onClick={() => setSelectedTemplate(template)}
                          className={`w-full px-4 py-3 text-left hover:bg-muted transition-colors ${
                            selectedTemplate?.id === template.id
                              ? "bg-violet-50 border-l-2 border-violet-500"
                              : ""
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-foreground">{template.name}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                {template.channel === "email" ? (
                                  <Mail className="h-3.5 w-3.5" />
                                ) : (
                                  <Smartphone className="h-3.5 w-3.5" />
                                )}{" "}
                                {template.channel}
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
                onDelete={() => setDeleteConfirmOpen(true)}
                previewMode={previewMode}
                onTogglePreview={() => setPreviewMode(!previewMode)}
              />
            ) : (
              <div className="bg-card rounded-xl border border-border h-[500px] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="font-medium">Select a template to edit</p>
                  <p className="text-sm">Or add one from the prebuilt gallery below</p>
                </div>
              </div>
            )}

            {/* Variables Reference */}
            <div className="mt-6 bg-card rounded-xl border border-border p-4">
              <h4 className="font-medium text-foreground mb-3">Available Variables</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {TEMPLATE_VARIABLES.map((v) => (
                  <div
                    key={v.key}
                    className="px-2 py-1 bg-muted rounded text-xs cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => navigator.clipboard.writeText(v.key)}
                    title={`Click to copy: ${v.key}`}
                  >
                    <code className="text-violet-600">{v.key}</code>
                    <div className="text-muted-foreground text-[10px]">{v.desc}</div>
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
          onTemplateAdded={handleTemplateAdded}
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

        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Template</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this template? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (selectedTemplate) {
                    deleteMutation.mutate(selectedTemplate.id);
                  }
                  setDeleteConfirmOpen(false);
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
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
  const [saved, setSaved] = useState(false);
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
    setSaved(false);
  }, [template, reset]);

  const onSubmit = async (data: TemplateEditorFormData) => {
    try {
      await apiClient.updateCampaignTemplate(template.id, {
        name: data.name,
        subject: data.subject || undefined,
        html: data.html || undefined,
        textBody: data.textBody || undefined,
      });
      onSave();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
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
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">
            {template.channel === "email" ? (
              <Mail className="h-5 w-5" />
            ) : (
              <Smartphone className="h-5 w-5" />
            )}
          </span>
          <Input
            type="text"
            {...register("name")}
            className="font-semibold text-foreground bg-transparent border-none outline-none focus:ring-0 text-lg"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePreview}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              previewMode
                ? "bg-violet-100 text-violet-700"
                : "bg-muted text-muted-foreground hover:bg-muted"
            }`}
          >
            {previewMode ? "Edit" : "Preview"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm transition-colors"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={!isDirty && !saved}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
              saved
                ? "bg-emerald-600 text-white"
                : "bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
            }`}
          >
            {saved ? (
              <>
                <Check className="h-4 w-4" /> Saved
              </>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
        {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}

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
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="bg-muted px-4 py-2 border-b border-border text-sm text-muted-foreground">
              Preview (with sample data)
            </div>
            {template.channel === "email" ? (
              <div
                className="p-4 bg-card"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify?.sanitize(previewHtml) || previewHtml,
                }}
              />
            ) : (
              <div className="p-4 bg-muted text-foreground font-mono text-sm whitespace-pre-wrap">
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
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    control,
  } = useForm<CreateTemplateFormData>({
    defaultValues: {
      name: "",
      channel: "email",
      category: "general",
    },
    mode: "onChange",
  });

  const channel = watch("channel");

  // Focus management and escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    firstInputRef.current?.focus();
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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
      onCreated(result);
    } catch (err) {
      console.error("Failed to create template:", err);
    }
  };

  // Combine register with ref
  const nameRegister = register("name");

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-template-title"
    >
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-6 motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-200">
        <div className="flex items-center justify-between mb-6">
          <h2 id="create-template-title" className="text-xl font-bold text-foreground">
            New Template
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-muted-foreground hover:text-muted-foreground p-1 rounded
              focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            label="Template Name *"
            placeholder="Booking Confirmation"
            error={errors.name?.message}
            showSuccess
            {...nameRegister}
            ref={(e) => {
              nameRegister.ref(e);
              firstInputRef.current = e;
            }}
          />

          <div>
            <label id="channel-label" className="block text-sm font-medium text-foreground mb-1">
              Channel
            </label>
            <div className="flex gap-2" role="radiogroup" aria-labelledby="channel-label">
              <button
                type="button"
                role="radio"
                aria-checked={channel === "email"}
                onClick={() => setValue("channel", "email", { shouldValidate: true })}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150
                  focus-visible:ring-2 focus-visible:ring-violet-500 flex items-center justify-center gap-1.5
                  ${
                    channel === "email"
                      ? "bg-violet-100 text-violet-700 border-2 border-violet-300"
                      : "bg-muted text-muted-foreground border border-border hover:border-border"
                  }`}
              >
                <Mail className="h-4 w-4" /> Email
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={channel === "sms"}
                onClick={() => setValue("channel", "sms", { shouldValidate: true })}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150
                  focus-visible:ring-2 focus-visible:ring-violet-500 flex items-center justify-center gap-1.5
                  ${
                    channel === "sms"
                      ? "bg-violet-100 text-violet-700 border-2 border-violet-300"
                      : "bg-muted text-muted-foreground border border-border hover:border-border"
                  }`}
              >
                <Smartphone className="h-4 w-4" /> SMS
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="category-select"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Category
            </label>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="category-select" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat} className="capitalize">
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border text-foreground rounded-lg
                hover:bg-muted transition-colors
                focus-visible:ring-2 focus-visible:ring-ring"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!watch("name")?.trim()}
              className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg
                hover:bg-violet-700 active:scale-[0.98] transition-all duration-150
                disabled:opacity-50
                focus-visible:ring-2 focus-visible:ring-violet-500"
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
  onTemplateAdded: (templateName: string) => void;
}) {
  const [addingTemplate, setAddingTemplate] = useState<string | null>(null);
  const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null);

  const handleAddTemplate = async (template: (typeof PREBUILT_TEMPLATES)[0]) => {
    setAddingTemplate(template.name);
    try {
      await apiClient.createCampaignTemplate(campgroundId, {
        name: template.name,
        channel: template.channel,
        category: template.category ?? undefined,
        subject: template.subject || undefined,
        html: template.html || undefined,
        textBody: template.textBody || undefined,
      });
      setRecentlyAdded(template.name);
      onTemplateAdded(template.name);
      // Clear recently added after animation
      setTimeout(() => setRecentlyAdded(null), 2000);
    } catch (err) {
      console.error("Failed to add prebuilt template:", err);
    } finally {
      setAddingTemplate(null);
    }
  };

  const alreadyAdded = (name: string) => existingTemplateNames.includes(name);

  return (
    <div className="mt-8 bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5" /> Prebuilt Templates
          </h3>
          <p className="text-sm text-muted-foreground">
            Professional templates ready to use - just click to add
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PREBUILT_TEMPLATES.map((template) => {
          const added = alreadyAdded(template.name);
          const isAdding = addingTemplate === template.name;
          const justAdded = recentlyAdded === template.name;

          return (
            <div
              key={template.name}
              className={`border rounded-lg p-4 transition-all duration-300 ${
                justAdded
                  ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500 ring-opacity-50"
                  : added
                    ? "bg-muted border-border"
                    : "bg-card border-border hover:border-violet-300 hover:shadow-sm"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {template.channel === "email" ? (
                      <Mail className="h-5 w-5" />
                    ) : (
                      <Smartphone className="h-5 w-5" />
                    )}
                  </span>
                  <span className="font-medium text-foreground text-sm">{template.name}</span>
                </div>
                <span className="text-[10px] uppercase text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {template.category}
                </span>
              </div>

              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                {template.channel === "email"
                  ? template.subject
                  : template.textBody?.slice(0, 60) + "..."}
              </p>

              {justAdded ? (
                <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium motion-safe:animate-in motion-safe:fade-in">
                  <Check className="h-4 w-4" /> Added! Check your templates above
                </div>
              ) : added ? (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Check className="h-3.5 w-3.5 text-emerald-600" /> Already in your templates
                </span>
              ) : (
                <button
                  onClick={() => handleAddTemplate(template)}
                  disabled={isAdding}
                  className="w-full px-3 py-2 text-sm font-medium text-violet-600 bg-violet-50 rounded-lg
                    hover:bg-violet-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isAdding ? (
                    <>
                      <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-violet-600" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" /> Add Template
                    </>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Lightbulb className="h-4 w-4" />
          <span>After adding templates, connect them to triggers to automate sending.</span>
        </p>
        <Link
          href="/dashboard/settings/notification-triggers"
          className="text-violet-600 hover:text-violet-700 font-medium text-sm flex items-center gap-1"
        >
          Set up Triggers <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
