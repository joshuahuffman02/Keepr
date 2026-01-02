"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  Ticket,
  CheckCircle,
  XCircle,
  CreditCard,
  AlertTriangle,
  Bell,
  LogOut,
  Tent,
  DollarSign,
  Star,
  Target,
  Users,
  Mail,
  Smartphone,
  Rocket,
  Lightbulb,
  Send,
  Trash2,
  Sparkles,
  Check,
  Plus,
  X,
  AlertCircle,
} from "lucide-react";

type TriggerEvent =
  | "reservation_created"
  | "reservation_confirmed"
  | "reservation_cancelled"
  | "payment_received"
  | "payment_failed"
  | "checkin_reminder"
  | "checkout_reminder"
  | "site_ready"
  | "balance_due"
  | "review_request"
  | "waitlist_match"
  | "group_update";

interface NotificationTrigger {
  id: string;
  campgroundId: string;
  event: string;
  channel: "email" | "sms" | "both";
  enabled: boolean;
  templateId: string | null;
  delayMinutes: number;
  conditions?: any;
  createdAt: string;
  updatedAt: string;
  template?: {
    id: string;
    name: string;
    subject: string | null;
  } | null;
}

const EVENT_ICONS: Record<TriggerEvent, ReactNode> = {
  reservation_created: <Ticket className="h-5 w-5" />,
  reservation_confirmed: <CheckCircle className="h-5 w-5" />,
  reservation_cancelled: <XCircle className="h-5 w-5" />,
  payment_received: <CreditCard className="h-5 w-5" />,
  payment_failed: <AlertTriangle className="h-5 w-5" />,
  checkin_reminder: <Bell className="h-5 w-5" />,
  checkout_reminder: <LogOut className="h-5 w-5" />,
  site_ready: <Tent className="h-5 w-5" />,
  balance_due: <DollarSign className="h-5 w-5" />,
  review_request: <Star className="h-5 w-5" />,
  waitlist_match: <Target className="h-5 w-5" />,
  group_update: <Users className="h-5 w-5" />,
};

const EVENT_OPTIONS: { value: TriggerEvent; label: string; description: string }[] = [
  { value: "reservation_created", label: "Reservation Created", description: "When a new booking is made" },
  { value: "reservation_confirmed", label: "Reservation Confirmed", description: "When booking is confirmed" },
  { value: "reservation_cancelled", label: "Reservation Cancelled", description: "When booking is cancelled" },
  { value: "payment_received", label: "Payment Received", description: "When payment is processed" },
  { value: "payment_failed", label: "Payment Failed", description: "When payment fails" },
  { value: "checkin_reminder", label: "Check-in Reminder", description: "Before arrival date" },
  { value: "checkout_reminder", label: "Check-out Reminder", description: "Before departure date" },
  { value: "site_ready", label: "Site Ready", description: "When housekeeping marks site ready" },
  { value: "balance_due", label: "Balance Due", description: "Reminder for unpaid balance" },
  { value: "review_request", label: "Review Request", description: "After checkout" },
  { value: "waitlist_match", label: "Waitlist Match", description: "When a site becomes available" },
  { value: "group_update", label: "Group Update", description: "When group booking changes" },
];

const CHANNEL_OPTIONS: { value: string; label: string; icon: ReactNode }[] = [
  { value: "email", label: "Email", icon: <Mail className="h-4 w-4" /> },
  { value: "sms", label: "SMS", icon: <Smartphone className="h-4 w-4" /> },
  { value: "both", label: "Both", icon: <><Mail className="h-4 w-4" /><Smartphone className="h-4 w-4" /></> },
];

const DELAY_PRESETS = [
  { label: "Immediately", value: 0 },
  { label: "1 hour before", value: 60 },
  { label: "24 hours before", value: 1440 },
  { label: "3 days before", value: 4320 },
];

export default function NotificationTriggersPage() {
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<NotificationTrigger | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showTestModal, setShowTestModal] = useState<NotificationTrigger | null>(null);
  const [hadNoTriggers, setHadNoTriggers] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setCampgroundId(stored);
  }, []);

  const triggersQuery = useQuery({
    queryKey: ["notification-triggers", campgroundId],
    queryFn: () => apiClient.getNotificationTriggers(campgroundId!),
    enabled: !!campgroundId,
  });

  // Track if this is their first trigger
  useEffect(() => {
    if (triggersQuery.data?.length === 0) {
      setHadNoTriggers(true);
    }
  }, [triggersQuery.data]);

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiClient.updateNotificationTrigger(id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification-triggers"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteNotificationTrigger(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification-triggers"] }),
  });

  const triggers = triggersQuery.data ?? [];

  // Group triggers by event
  const triggersByEvent = EVENT_OPTIONS.map(event => ({
    ...event,
    triggers: triggers.filter(t => t.event === event.value)
  }));

  const handleQuickCreate = async (event: TriggerEvent, channel: "email" | "sms" | "both", delayMinutes = 0) => {
    if (!campgroundId) return;
    try {
      await apiClient.createNotificationTrigger(campgroundId, {
        event,
        channel,
        enabled: true,
        delayMinutes,
      });
      queryClient.invalidateQueries({ queryKey: ["notification-triggers"] });
      if (hadNoTriggers) {
        setShowCelebration(true);
        setHadNoTriggers(false);
      }
    } catch (err) {
      console.error("Failed to create trigger:", err);
    }
  };

  const handleTriggerSaved = () => {
    setShowCreateModal(false);
    setEditingTrigger(null);
    queryClient.invalidateQueries({ queryKey: ["notification-triggers"] });
    if (hadNoTriggers) {
      setShowCelebration(true);
      setHadNoTriggers(false);
    }
  };

  if (!campgroundId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Select a campground to manage notification triggers</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notification Triggers</h1>
          <p className="text-muted-foreground mt-1">Automate emails and SMS based on events</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-action-primary text-action-primary-foreground rounded-lg font-medium
            hover:bg-action-primary-hover active:scale-[0.98]
            transition-all duration-150 ease-out
            focus-visible:ring-2 focus-visible:ring-action-primary focus-visible:ring-offset-2
            flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> New Trigger
        </button>
      </div>

      {/* Empty State */}
      {triggers.length === 0 && !triggersQuery.isLoading && (
        <div className="bg-status-info/10 rounded-2xl p-8 text-center border border-status-info/20 mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-status-info/15 rounded-full">
              <Rocket className="h-10 w-10 text-status-info" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Automate Your Guest Communication
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Set up triggers to automatically send emails and SMS when important events happen—
            like booking confirmations, check-in reminders, and payment receipts.
          </p>

          {/* Quick Start Suggestions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6 max-w-2xl mx-auto">
            <QuickStartCard
              icon={<CheckCircle className="h-6 w-6 text-emerald-600" />}
              title="Booking Confirmation"
              description="Instant confirmation when guests book"
              onClick={() => handleQuickCreate("reservation_created", "email")}
            />
            <QuickStartCard
              icon={<Bell className="h-6 w-6 text-amber-600" />}
              title="Check-in Reminder"
              description="24 hours before arrival"
              onClick={() => handleQuickCreate("checkin_reminder", "email", 1440)}
            />
            <QuickStartCard
              icon={<Star className="h-6 w-6 text-yellow-500" />}
              title="Review Request"
              description="After checkout"
              onClick={() => handleQuickCreate("review_request", "email")}
            />
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-violet-600 text-white rounded-lg font-medium
              hover:bg-violet-700 active:scale-[0.98] transition-all
              focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            Create Custom Trigger
          </button>
        </div>
      )}

      {/* Info Box - only show when they have triggers */}
      {triggers.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2 text-sm text-amber-900 mb-6">
          <div className="font-semibold flex items-center gap-2">
            <Lightbulb className="h-4 w-4" /> How to customize messages
          </div>
          <ul className="list-disc pl-6 space-y-1">
            <li>Create or edit a template in <Link href="/dashboard/settings/templates" className="underline font-semibold text-amber-800 hover:text-amber-900">Settings → Templates</Link>.</li>
            <li>Pick the template when you set up the trigger. If none is set, the default system message is used.</li>
            <li>Use <strong>Send Test</strong> to preview exactly what guests will receive.</li>
          </ul>
        </div>
      )}

      {/* Triggers by Event */}
      {triggersQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
        </div>
      ) : triggers.length > 0 ? (
        <div className="space-y-4">
          {triggersByEvent.map(({ value, label, description, triggers: eventTriggers }) => (
            <div
              key={value}
              className="bg-card rounded-xl border border-border overflow-hidden
                transition-all duration-200 ease-out hover:shadow-sm"
            >
              <div className="px-5 py-4 bg-muted border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-card rounded-lg border border-border text-muted-foreground">
                    {EVENT_ICONS[value]}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{label}</h3>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">
                  {eventTriggers.length} trigger{eventTriggers.length !== 1 ? "s" : ""}
                </span>
              </div>

              {eventTriggers.length > 0 ? (
                <div className="divide-y divide-border">
                  {eventTriggers.map(trigger => (
                    <TriggerRow
                      key={trigger.id}
                      trigger={trigger}
                      onToggle={(enabled) => toggleMutation.mutate({ id: trigger.id, enabled })}
                      onEdit={() => setEditingTrigger(trigger)}
                      onTest={() => setShowTestModal(trigger)}
                      onDelete={() => deleteMutation.mutate(trigger.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="px-5 py-6 text-center text-muted-foreground text-sm">
                  No triggers configured for this event
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingTrigger) && (
        <TriggerModal
          campgroundId={campgroundId}
          trigger={editingTrigger}
          onClose={() => {
            setShowCreateModal(false);
            setEditingTrigger(null);
          }}
          onSaved={handleTriggerSaved}
        />
      )}

      {/* Test Modal */}
      {showTestModal && (
        <TestTriggerModal
          trigger={showTestModal}
          onClose={() => setShowTestModal(null)}
        />
      )}

      {/* Celebration Modal */}
      {showCelebration && (
        <CelebrationModal onClose={() => setShowCelebration(false)} />
      )}
    </div>
  );
}

function QuickStartCard({
  icon,
  title,
  description,
  onClick
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="p-4 bg-card rounded-xl border border-border text-left
        hover:border-violet-300 hover:shadow-sm transition-all duration-200 group
        focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
    >
      <div className="group-hover:scale-110 inline-block transition-transform motion-safe:duration-200">
        {icon}
      </div>
      <div className="font-medium text-foreground mt-2">{title}</div>
      <div className="text-xs text-muted-foreground">{description}</div>
    </button>
  );
}

function TriggerRow({
  trigger,
  onToggle,
  onEdit,
  onTest,
  onDelete,
}: {
  trigger: NotificationTrigger;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onTest: () => void;
  onDelete: () => void;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const eventLabel = EVENT_OPTIONS.find(e => e.value === trigger.event)?.label ?? trigger.event;
  const channelOption = CHANNEL_OPTIONS.find(c => c.value === trigger.channel);

  return (
    <div className="px-5 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {/* Accessible Toggle Switch */}
        <button
          onClick={() => onToggle(!trigger.enabled)}
          role="switch"
          aria-checked={trigger.enabled}
          aria-label={`${trigger.enabled ? "Disable" : "Enable"} ${eventLabel} trigger`}
          className={`relative w-12 h-6 rounded-full transition-colors duration-200
            focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2
            ${trigger.enabled ? "bg-emerald-500" : "bg-muted"}`}
        >
          <span
            className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-card shadow-sm
              transition-transform duration-200 ease-out
              ${trigger.enabled ? "translate-x-6" : "translate-x-0"}`}
          />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
              {channelOption?.icon} {channelOption?.label}
            </span>
            {trigger.delayMinutes > 0 && (
              <span className="text-xs bg-status-warning/15 text-status-warning px-2 py-0.5 rounded">
                {formatDelay(trigger.delayMinutes)}
              </span>
            )}
          </div>
          {trigger.template && (
            <span className="text-xs text-muted-foreground">
              Template: {trigger.template.name}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onTest}
          className="px-3 py-1.5 text-sm text-violet-600 hover:text-violet-700 hover:bg-violet-50 rounded
            transition-colors duration-150 flex items-center gap-1.5
            focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          <Send className="h-3.5 w-3.5" /> Test
        </button>
        <button
          onClick={onEdit}
          className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded
            transition-colors duration-150
            focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          Edit
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded
            transition-colors duration-150
            focus-visible:ring-2 focus-visible:ring-red-500"
        >
          Delete
        </button>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <DeleteConfirmModal
          itemName={`${eventLabel} trigger`}
          onConfirm={() => {
            onDelete();
            setShowDeleteConfirm(false);
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}

function formatDelay(minutes: number): string {
  if (minutes < 60) return `${minutes}min delay`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h before`;
  return `${Math.round(minutes / 1440)}d before`;
}

function DeleteConfirmModal({
  itemName,
  onConfirm,
  onCancel,
}: {
  itemName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-title"
      aria-describedby="delete-desc"
    >
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-200">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-status-error/15 rounded-full">
            <Trash2 className="h-6 w-6 text-status-error" />
          </div>
        </div>
        <h2 id="delete-title" className="text-xl font-bold text-foreground text-center mb-2">
          Delete {itemName}?
        </h2>
        <p id="delete-desc" className="text-muted-foreground text-center mb-6">
          This action cannot be undone. Guests will no longer receive this notification.
        </p>
        <div className="flex gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-border text-foreground rounded-lg
              hover:bg-muted transition-colors
              focus-visible:ring-2 focus-visible:ring-ring"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg
              hover:bg-red-700 transition-colors
              focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

interface Template {
  id: string;
  name: string;
  channel: "email" | "sms" | "both";
  subject: string | null;
}

function TriggerModal({
  campgroundId,
  trigger,
  onClose,
  onSaved,
}: {
  campgroundId: string;
  trigger: NotificationTrigger | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLSelectElement>(null);

  const [event, setEvent] = useState<TriggerEvent>(trigger?.event as TriggerEvent ?? "reservation_created");
  const [channel, setChannel] = useState<"email" | "sms" | "both">(trigger?.channel ?? "email");
  const [templateId, setTemplateId] = useState<string | null>(trigger?.templateId ?? null);
  const [enabled, setEnabled] = useState(trigger?.enabled ?? true);
  const [delayMinutes, setDelayMinutes] = useState(trigger?.delayMinutes ?? 0);
  const [showCustomDelay, setShowCustomDelay] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch available templates
  const templatesQuery = useQuery({
    queryKey: ["campaign-templates", campgroundId],
    queryFn: () => apiClient.getCampaignTemplates(campgroundId),
    enabled: !!campgroundId,
  });

  const templates = (templatesQuery.data ?? []) as Template[];

  // Filter templates by compatible channel
  const compatibleTemplates = templates.filter(t => {
    if (channel === "both") return true;
    if (t.channel === "both") return true;
    return t.channel === channel;
  });

  // Focus management and escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    firstFocusRef.current?.focus();
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (trigger) {
        await apiClient.updateNotificationTrigger(trigger.id, {
          event,
          channel,
          enabled,
          delayMinutes,
          templateId: templateId || null,
        });
      } else {
        await apiClient.createNotificationTrigger(campgroundId, {
          event,
          channel,
          enabled,
          delayMinutes,
          templateId: templateId || undefined,
        });
      }
      onSaved();
    } catch (err) {
      console.error("Failed to save trigger:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-6 motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-200"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id="modal-title" className="text-xl font-bold text-foreground">
            {trigger ? "Edit Trigger" : "New Trigger"}
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

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Event Select */}
          <div>
            <label htmlFor="event-select" className="block text-sm font-medium text-foreground mb-1">
              When this happens...
            </label>
            <select
              id="event-select"
              ref={firstFocusRef}
              value={event}
              onChange={e => setEvent(e.target.value as TriggerEvent)}
              className="w-full px-3 py-2 border border-border rounded-lg
                focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            >
              {EVENT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Channel Select */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Send notification via...
            </label>
            <div className="flex gap-2" role="radiogroup" aria-label="Notification channel">
              {CHANNEL_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={channel === opt.value}
                  onClick={() => setChannel(opt.value as "email" | "sms" | "both")}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150
                    focus-visible:ring-2 focus-visible:ring-violet-500 flex items-center justify-center gap-1.5
                    ${channel === opt.value
                      ? "bg-violet-100 text-violet-700 border-2 border-violet-300"
                      : "bg-muted text-muted-foreground border border-border hover:border-border"
                    }`}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Template Select */}
          <div>
            <label htmlFor="template-select" className="block text-sm font-medium text-foreground mb-1">
              Use template
            </label>
            {templatesQuery.isLoading ? (
              <div className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-muted-foreground">
                Loading templates...
              </div>
            ) : compatibleTemplates.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  No {channel} templates available.{" "}
                  <Link href="/dashboard/settings/templates" className="underline font-medium hover:text-amber-900">
                    Create one first
                  </Link>
                </p>
              </div>
            ) : (
              <select
                id="template-select"
                value={templateId ?? ""}
                onChange={e => setTemplateId(e.target.value || null)}
                className="w-full px-3 py-2 border border-border rounded-lg
                  focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              >
                <option value="">Default system message</option>
                {compatibleTemplates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.channel !== channel && t.channel !== "both" ? `(${t.channel})` : ""}
                  </option>
                ))}
              </select>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Choose a template or use the default message
            </p>
          </div>

          {/* Delay Presets */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              When to send
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {DELAY_PRESETS.map(preset => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => {
                    setDelayMinutes(preset.value);
                    setShowCustomDelay(false);
                  }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150
                    focus-visible:ring-2 focus-visible:ring-violet-500
                    ${delayMinutes === preset.value && !showCustomDelay
                      ? "bg-violet-100 text-violet-700 border-2 border-violet-300"
                      : "bg-muted text-muted-foreground border border-border hover:border-border"
                    }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom delay toggle */}
            <button
              type="button"
              onClick={() => setShowCustomDelay(!showCustomDelay)}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              {showCustomDelay ? "Use preset" : "Custom timing..."}
            </button>

            {showCustomDelay && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={delayMinutes}
                  onChange={e => setDelayMinutes(parseInt(e.target.value) || 0)}
                  className="w-24 px-3 py-2 border border-border rounded-lg
                    focus:ring-2 focus:ring-violet-500"
                  aria-label="Delay in minutes"
                />
                <span className="text-muted-foreground text-sm">minutes</span>
              </div>
            )}
          </div>

          {/* Enabled Toggle */}
          <label className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted transition-colors">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
              className="rounded border-border text-violet-600 focus:ring-violet-500"
            />
            <div>
              <div className="font-medium text-foreground">Enabled</div>
              <div className="text-sm text-muted-foreground">Trigger will fire when event occurs</div>
            </div>
          </label>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
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
              disabled={saving}
              className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg
                hover:bg-violet-700 active:scale-[0.98] transition-all duration-150
                disabled:opacity-50
                focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              {saving ? "Saving..." : trigger ? "Update" : "Create Trigger"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TestTriggerModal({
  trigger,
  onClose,
}: {
  trigger: NotificationTrigger;
  onClose: () => void;
}) {
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const eventInfo = EVENT_OPTIONS.find(e => e.value === trigger.event);
  const channelOption = CHANNEL_OPTIONS.find(c => c.value === trigger.channel);

  const handleSendTest = async () => {
    if (!testEmail) return;
    setSending(true);
    setError(null);
    try {
      await apiClient.testNotificationTrigger(trigger.id, testEmail);
      setSent(true);
    } catch (err) {
      setError("Failed to send test. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="test-modal-title"
    >
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-6 motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-200">
        <div className="flex items-center justify-between mb-4">
          <h2 id="test-modal-title" className="text-xl font-bold text-foreground">
            Test This Trigger
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

        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg mb-4">
          <div className="p-2 bg-card rounded-lg border border-border text-muted-foreground">
            {EVENT_ICONS[trigger.event as TriggerEvent]}
          </div>
          <div>
            <div className="font-medium text-foreground">{eventInfo?.label}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              {channelOption?.icon} {channelOption?.label}
            </div>
          </div>
        </div>

        <p className="text-muted-foreground text-sm mb-4">
          Send a test notification to see exactly what your guests will receive.
          We'll use sample data to fill in the template variables.
        </p>

        {sent ? (
          <div className="flex items-center gap-3 text-emerald-700 bg-emerald-50 p-4 rounded-lg mb-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
            <Check className="h-5 w-5" />
            <div>
              <div className="font-medium">Test sent!</div>
              <div className="text-sm text-emerald-600">Check your inbox at {testEmail}</div>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label htmlFor="test-email" className="block text-sm font-medium text-foreground mb-1">
                Send test to
              </label>
              <input
                id="test-email"
                ref={inputRef}
                type="email"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-3 py-2 border border-border rounded-lg
                  focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              />
            </div>

            {error && (
              <div role="alert" className="text-red-600 text-sm mb-4 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            )}

            <button
              onClick={handleSendTest}
              disabled={!testEmail || sending}
              className="w-full py-2.5 bg-violet-600 text-white rounded-lg font-medium
                hover:bg-violet-700 active:scale-[0.98] transition-all duration-150
                disabled:opacity-50 disabled:cursor-not-allowed
                focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              {sending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Sending...
                </span>
              ) : (
                "Send Test Email"
              )}
            </button>
          </>
        )}

        {sent && (
          <button
            onClick={onClose}
            className="w-full mt-3 py-2 border border-border text-foreground rounded-lg
              hover:bg-muted transition-colors
              focus-visible:ring-2 focus-visible:ring-ring"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}

function CelebrationModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      // Auto-close after 5 seconds
    }, 5000);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
    >
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-300">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-violet-100 rounded-full">
            <Sparkles className="h-10 w-10 text-violet-600" />
          </div>
        </div>
        <h2 id="celebration-title" className="text-2xl font-bold text-foreground mb-2">
          Your first automation is live!
        </h2>
        <p className="text-muted-foreground mb-6">
          Guests will now receive automatic notifications.
          You're saving hours of manual work!
        </p>
        <button
          onClick={onClose}
          autoFocus
          className="px-6 py-2.5 bg-violet-600 text-white rounded-lg font-medium
            hover:bg-violet-700 active:scale-[0.98] transition-all duration-150
            focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
        >
          Awesome!
        </button>
      </div>
    </div>
  );
}
