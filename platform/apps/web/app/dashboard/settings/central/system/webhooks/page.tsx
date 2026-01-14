"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Webhook,
  Plus,
  ExternalLink,
  Loader2,
  Info,
  MoreHorizontal,
  Trash2,
  CheckCircle,
  XCircle,
  Globe,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiClient } from "@/lib/api-client";

interface WebhookEndpoint {
  id: string;
  campgroundId?: string | null;
  url: string;
  eventTypes: string[];
  isActive: boolean;
  description: string | null;
  createdAt: string;
}

const EVENT_TYPES = [
  { value: "reservation.created", label: "Reservation Created" },
  { value: "reservation.updated", label: "Reservation Updated" },
  { value: "reservation.cancelled", label: "Reservation Cancelled" },
  { value: "payment.received", label: "Payment Received" },
  { value: "checkin.completed", label: "Check-in Completed" },
  { value: "checkout.completed", label: "Check-out Completed" },
  { value: "guest.created", label: "Guest Created" },
  { value: "guest.updated", label: "Guest Updated" },
];

export default function WebhooksPage() {
  const [loading, setLoading] = useState(true);
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("campreserv:selectedCampground");
    setCampgroundId(id);

    if (!id) {
      setLoading(false);
      return;
    }

    loadWebhooks(id);
  }, []);

  const loadWebhooks = async (id: string) => {
    try {
      const data = await apiClient.listWebhooks(id);
      setWebhooks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load webhooks:", err);
      setWebhooks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (webhook: WebhookEndpoint) => {
    try {
      await apiClient.toggleWebhook(webhook.id, !webhook.isActive, campgroundId ?? undefined);
      if (campgroundId) loadWebhooks(campgroundId);
    } catch (err) {
      console.error("Failed to toggle webhook:", err);
    }
  };

  const handleCreate = async () => {
    if (!campgroundId) return;
    if (!newUrl.trim()) {
      setError("URL is required");
      return;
    }
    if (selectedEvents.length === 0) {
      setError("Select at least one event type");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiClient.createWebhook(campgroundId, {
        url: newUrl.trim(),
        eventTypes: selectedEvents,
        description: newDescription.trim() || undefined,
      });
      setIsModalOpen(false);
      setNewUrl("");
      setNewDescription("");
      setSelectedEvents([]);
      loadWebhooks(campgroundId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create webhook";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const toggleEventType = (eventType: string) => {
    if (selectedEvents.includes(eventType)) {
      setSelectedEvents(selectedEvents.filter((e) => e !== eventType));
    } else {
      setSelectedEvents([...selectedEvents, eventType]);
    }
  };

  const activeCount = webhooks.filter((w) => w.isActive).length;

  if (loading) {
    return (
      <div className="max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Webhooks</h2>
          <p className="text-muted-foreground mt-1">
            Configure webhook endpoints for integrations
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!campgroundId) {
    return (
      <div className="max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Webhooks</h2>
          <p className="text-muted-foreground mt-1">
            Configure webhook endpoints for integrations
          </p>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <Info className="h-8 w-8 text-amber-500 mx-auto mb-3" />
            <p className="text-muted-foreground">Please select a campground first.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Webhooks</h2>
          <p className="text-muted-foreground mt-1">
            Configure webhook endpoints for integrations
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Webhook
        </Button>
      </div>

      {/* Info */}
      <Alert className="bg-orange-50 border-orange-200">
        <Webhook className="h-4 w-4 text-orange-500" />
        <AlertDescription className="text-orange-800">
          Webhooks send real-time HTTP POST requests to your server when events occur.
          Use them to integrate with external systems, automation tools, or custom applications.
        </AlertDescription>
      </Alert>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100">
                <Webhook className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{webhooks.length}</p>
                <p className="text-sm text-muted-foreground">Total Webhooks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{activeCount}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <XCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {webhooks.length - activeCount}
                </p>
                <p className="text-sm text-muted-foreground">Inactive</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Webhooks List */}
      {webhooks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Webhook className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No webhooks configured
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Add webhook endpoints to receive real-time notifications when
              events occur in your campground.
            </p>
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook) => (
            <Card key={webhook.id} className={!webhook.isActive ? "opacity-60" : ""}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Switch
                      checked={webhook.isActive}
                      onCheckedChange={() => handleToggle(webhook)}
                    />
                    <div className="p-2 rounded-lg bg-orange-100">
                      <Globe className="h-5 w-5 text-orange-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-foreground truncate max-w-md">
                        {webhook.url}
                      </p>
                      {webhook.description && (
                        <p className="text-sm text-muted-foreground">{webhook.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {webhook.eventTypes.slice(0, 3).map((eventType) => (
                          <Badge key={eventType} variant="outline" className="text-xs">
                            {eventType}
                          </Badge>
                        ))}
                        {webhook.eventTypes.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{webhook.eventTypes.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={webhook.isActive ? "default" : "secondary"}>
                      {webhook.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="More options" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href="/dashboard/settings/webhooks">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Deliveries
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
            <DialogDescription>
              Configure a new webhook endpoint to receive event notifications.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Endpoint URL</Label>
              <Input
                placeholder="https://your-server.com/webhook"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Input
                placeholder="e.g. Zapier integration"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Event Types</Label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                {EVENT_TYPES.map((event) => (
                  <label
                    key={event.value}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedEvents.includes(event.value)}
                      onCheckedChange={() => toggleEventType(event.value)}
                      aria-label={event.label}
                    />
                    <span className="text-sm">{event.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleCreate} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Webhook"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
