"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { apiClient } from "@/lib/api-client";

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
  conditions: any;
  createdAt: string;
  updatedAt: string;
  template?: {
    id: string;
    name: string;
    subject: string | null;
  } | null;
}

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

const CHANNEL_OPTIONS = [
  { value: "email", label: "📧 Email" },
  { value: "sms", label: "📱 SMS" },
  { value: "both", label: "📧📱 Both" },
];

export default function NotificationTriggersPage() {
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<NotificationTrigger | null>(null);
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

  if (!campgroundId) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-500">Select a campground to manage notification triggers</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="p-6 max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Notification Triggers</h1>
            <p className="text-slate-500 mt-1">Automate emails and SMS based on events</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition-colors flex items-center gap-2"
          >
            <span>+</span> New Trigger
          </button>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2 text-sm text-amber-900 mb-6">
          <div className="font-semibold">How to send messages</div>
          <ul className="list-disc pl-4 space-y-1">
            <li>Create or edit a template in <Link href="/settings/templates" className="underline font-semibold text-amber-800">Settings → Templates</Link>.</li>
            <li>Pick the template when you set up the trigger (email/SMS). If none is set, the default system message is used.</li>
            <li>Use delays for reminders (e.g., 1440 = 24h before check-in).</li>
          </ul>
        </div>

        {/* Triggers by Event */}
        {triggersQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
          </div>
        ) : (
          <div className="space-y-4">
            {triggersByEvent.map(({ value, label, description, triggers: eventTriggers }) => (
              <div key={value} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{label}</h3>
                    <p className="text-sm text-slate-500">{description}</p>
                  </div>
                  <span className="text-sm text-slate-400">
                    {eventTriggers.length} trigger{eventTriggers.length !== 1 ? "s" : ""}
                  </span>
                </div>
                
                {eventTriggers.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {eventTriggers.map(trigger => (
                      <div key={trigger.id} className="px-5 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => toggleMutation.mutate({ id: trigger.id, enabled: !trigger.enabled })}
                            className={`w-12 h-6 rounded-full transition-colors relative ${
                              trigger.enabled ? "bg-emerald-500" : "bg-slate-300"
                            }`}
                          >
                            <span
                              className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                                trigger.enabled ? "translate-x-6" : ""
                              }`}
                            />
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-900">
                                {CHANNEL_OPTIONS.find(c => c.value === trigger.channel)?.label}
                              </span>
                              {trigger.delayMinutes > 0 && (
                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                                  +{trigger.delayMinutes}min delay
                                </span>
                              )}
                            </div>
                            {trigger.template && (
                              <span className="text-xs text-slate-500">
                                Template: {trigger.template.name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingTrigger(trigger)}
                            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Delete this trigger?")) {
                                deleteMutation.mutate(trigger.id);
                              }
                            }}
                            className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-6 text-center text-slate-400 text-sm">
                    No triggers configured for this event
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        {(showCreateModal || editingTrigger) && (
          <TriggerModal
            campgroundId={campgroundId}
            trigger={editingTrigger}
            onClose={() => {
              setShowCreateModal(false);
              setEditingTrigger(null);
            }}
            onSaved={() => {
              setShowCreateModal(false);
              setEditingTrigger(null);
              queryClient.invalidateQueries({ queryKey: ["notification-triggers"] });
            }}
          />
        )}
      </div>
    </DashboardShell>
  );
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
  const [event, setEvent] = useState<TriggerEvent>(trigger?.event as TriggerEvent ?? "reservation_created");
  const [channel, setChannel] = useState<"email" | "sms" | "both">(trigger?.channel ?? "email");
  const [enabled, setEnabled] = useState(trigger?.enabled ?? true);
  const [delayMinutes, setDelayMinutes] = useState(trigger?.delayMinutes ?? 0);
  const [saving, setSaving] = useState(false);

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
        });
      } else {
        await apiClient.createNotificationTrigger(campgroundId, {
          event,
          channel,
          enabled,
          delayMinutes,
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900">
            {trigger ? "Edit Trigger" : "New Trigger"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Event</label>
            <select
              value={event}
              onChange={e => setEvent(e.target.value as TriggerEvent)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            >
              {EVENT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Channel</label>
            <div className="flex gap-2">
              {CHANNEL_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setChannel(opt.value as "email" | "sms" | "both")}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    channel === opt.value
                      ? "bg-violet-100 text-violet-700 border-2 border-violet-300"
                      : "bg-slate-50 text-slate-600 border border-slate-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Delay (minutes)</label>
            <input
              type="number"
              min="0"
              value={delayMinutes}
              onChange={e => setDelayMinutes(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
            <p className="text-xs text-slate-500 mt-1">
              0 = send immediately. Use delay for reminders (e.g., 1440 = 24 hours before)
            </p>
          </div>

          <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
              className="rounded border-slate-300"
            />
            <div>
              <div className="font-medium text-slate-900">Enabled</div>
              <div className="text-sm text-slate-500">Trigger will fire when event occurs</div>
            </div>
          </label>

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
              disabled={saving}
              className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : trigger ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

