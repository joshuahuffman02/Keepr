"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Bell,
  Mail,
  Smartphone,
  Plus,
  ExternalLink,
  Loader2,
  Info,
  Zap,
  CheckCircle,
  XCircle,
  CreditCard,
  LogOut,
  Star,
  Ticket,
  MoreHorizontal,
  Pencil,
  Trash2,
  Send,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { apiClient } from "@/lib/api-client";

interface NotificationTrigger {
  id: string;
  campgroundId: string;
  event: string;
  channel: "email" | "sms" | "both";
  enabled: boolean;
  templateId: string | null;
  delayMinutes: number;
  template?: {
    id: string;
    name: string;
    subject: string | null;
  } | null;
}

const EVENT_ICONS: Record<string, LucideIcon> = {
  reservation_created: Ticket,
  reservation_confirmed: CheckCircle,
  reservation_cancelled: XCircle,
  payment_received: CreditCard,
  checkin_reminder: Bell,
  checkout_reminder: LogOut,
  review_request: Star,
};

const EVENT_LABELS: Record<string, string> = {
  reservation_created: "Reservation Created",
  reservation_confirmed: "Reservation Confirmed",
  reservation_cancelled: "Reservation Cancelled",
  payment_received: "Payment Received",
  payment_failed: "Payment Failed",
  checkin_reminder: "Check-in Reminder",
  checkout_reminder: "Check-out Reminder",
  site_ready: "Site Ready",
  balance_due: "Balance Due",
  review_request: "Review Request",
  waitlist_match: "Waitlist Match",
  group_update: "Group Update",
};

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [triggers, setTriggers] = useState<NotificationTrigger[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("campreserv:selectedCampground");
    setCampgroundId(id);

    if (!id) {
      setLoading(false);
      return;
    }

    apiClient
      .getNotificationTriggers(id)
      .then((data) => {
        setTriggers(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load triggers:", err);
        setLoading(false);
      });
  }, []);

  const handleToggle = async (trigger: NotificationTrigger) => {
    setUpdating(trigger.id);
    try {
      await apiClient.updateNotificationTrigger(trigger.id, {
        enabled: !trigger.enabled,
      });
      setTriggers(triggers.map((t) => (t.id === trigger.id ? { ...t, enabled: !t.enabled } : t)));
    } catch (err) {
      console.error("Failed to update trigger:", err);
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.deleteNotificationTrigger(id);
      setTriggers(triggers.filter((t) => t.id !== id));
    } catch (err) {
      console.error("Failed to delete trigger:", err);
    }
  };

  const formatDelay = (minutes: number): string => {
    if (minutes === 0) return "Immediately";
    if (minutes < 60) return `${minutes}min delay`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h before`;
    return `${Math.round(minutes / 1440)}d before`;
  };

  const enabledCount = triggers.filter((t) => t.enabled).length;

  if (loading) {
    return (
      <div className="max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Notifications</h2>
          <p className="text-muted-foreground mt-1">Configure automated notification triggers</p>
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
          <h2 className="text-2xl font-bold text-foreground">Notifications</h2>
          <p className="text-muted-foreground mt-1">Configure automated notification triggers</p>
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
          <h2 className="text-2xl font-bold text-foreground">Notifications</h2>
          <p className="text-muted-foreground mt-1">Configure automated notification triggers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/settings/notification-triggers">
              <ExternalLink className="h-4 w-4 mr-2" />
              Full Manager
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/settings/notification-triggers">
              <Plus className="h-4 w-4 mr-2" />
              New Trigger
            </Link>
          </Button>
        </div>
      </div>

      {/* Info */}
      <Alert className="bg-purple-50 border-purple-200">
        <Zap className="h-4 w-4 text-purple-500" />
        <AlertDescription className="text-purple-800">
          Notification triggers automatically send emails or SMS when events occur. Connect a
          template to customize the message, or use the default system message.
        </AlertDescription>
      </Alert>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-status-success/15">
                <Zap className="h-5 w-5 text-status-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{enabledCount}</p>
                <p className="text-sm text-muted-foreground">Active Triggers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {triggers.filter((t) => t.channel === "email" || t.channel === "both").length}
                </p>
                <p className="text-sm text-muted-foreground">Email Triggers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-status-success/15">
                <Smartphone className="h-5 w-5 text-status-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {triggers.filter((t) => t.channel === "sms" || t.channel === "both").length}
                </p>
                <p className="text-sm text-muted-foreground">SMS Triggers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Triggers List */}
      {triggers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No notification triggers yet
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Set up automatic notifications for booking confirmations, check-in reminders, payment
              receipts, and more.
            </p>
            <Button asChild>
              <Link href="/dashboard/settings/notification-triggers">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Trigger
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="py-3 px-4 bg-muted/60 border-b">
            <CardTitle className="text-sm font-medium">All Triggers ({triggers.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y">
            {triggers.map((trigger) => {
              const Icon = EVENT_ICONS[trigger.event] || Bell;
              return (
                <div
                  key={trigger.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/60 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={trigger.enabled}
                      onCheckedChange={() => handleToggle(trigger)}
                      disabled={updating === trigger.id}
                    />
                    <div
                      className={`p-2 rounded-lg ${
                        trigger.enabled
                          ? "bg-status-success/15 text-status-success"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {EVENT_LABELS[trigger.event] || trigger.event}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          {trigger.channel === "email" ? (
                            <Mail className="h-3 w-3" />
                          ) : trigger.channel === "sms" ? (
                            <Smartphone className="h-3 w-3" />
                          ) : (
                            <>
                              <Mail className="h-3 w-3" />
                              <Smartphone className="h-3 w-3" />
                            </>
                          )}
                          {trigger.channel}
                        </span>
                        {trigger.delayMinutes > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {formatDelay(trigger.delayMinutes)}
                          </Badge>
                        )}
                        {trigger.template && (
                          <span className="text-muted-foreground">
                            Template: {trigger.template.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={trigger.enabled ? "default" : "secondary"}>
                      {trigger.enabled ? "Active" : "Disabled"}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="More options"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href="/dashboard/settings/notification-triggers">
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit Trigger
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/dashboard/settings/notification-triggers">
                            <Send className="h-4 w-4 mr-2" />
                            Send Test
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeleteConfirmId(trigger.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Quick Link to Templates */}
      <Card className="bg-status-info/10 border-status-info/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-status-info/15">
                <Mail className="h-5 w-5 text-status-info" />
              </div>
              <div>
                <p className="font-medium text-foreground">Customize Your Messages</p>
                <p className="text-sm text-muted-foreground">
                  Create email and SMS templates for your triggers
                </p>
              </div>
            </div>
            <Button variant="outline" asChild>
              <Link href="/dashboard/settings/central/system/templates">Manage Templates</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Trigger Confirmation */}
      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Trigger</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this notification trigger? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmId) {
                  handleDelete(deleteConfirmId);
                  setDeleteConfirmId(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Trigger
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
