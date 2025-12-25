"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { motion, useReducedMotion } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Calendar,
  CreditCard,
  LogIn,
  LogOut,
  AlertTriangle,
  Wrench,
  MessageSquare,
  ShoppingBag,
  UserPlus,
  Settings,
  Filter,
  Loader2,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  SPRING_CONFIG,
  fadeInUp,
  staggerContainer,
  staggerChild,
  getStaggerDelay,
  reducedMotion as reducedMotionVariants
} from "@/lib/animations";

type NotificationType =
  | "arrival"
  | "departure"
  | "task_assigned"
  | "task_sla_warning"
  | "maintenance_urgent"
  | "payment_received"
  | "payment_failed"
  | "message_received"
  | "general";

type Notification = {
  id: string;
  campgroundId: string;
  userId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  sentAt: string | null;
  readAt: string | null;
  clickedAt: string | null;
  createdAt: string;
};

const typeConfig: Record<NotificationType, { icon: React.ReactNode; color: string; label: string; href?: (data: Record<string, unknown> | null) => string }> = {
  arrival: {
    icon: <LogIn className="h-4 w-4" />,
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400",
    label: "Arrival",
    href: () => "/check-in-out"
  },
  departure: {
    icon: <LogOut className="h-4 w-4" />,
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400",
    label: "Departure",
    href: () => "/check-in-out"
  },
  task_assigned: {
    icon: <UserPlus className="h-4 w-4" />,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400",
    label: "Task",
    href: () => "/operations"
  },
  task_sla_warning: {
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400",
    label: "SLA Warning",
    href: () => "/operations"
  },
  maintenance_urgent: {
    icon: <Wrench className="h-4 w-4" />,
    color: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400",
    label: "Maintenance",
    href: () => "/maintenance"
  },
  payment_received: {
    icon: <CreditCard className="h-4 w-4" />,
    color: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400",
    label: "Payment",
    href: () => "/finance/payouts"
  },
  payment_failed: {
    icon: <CreditCard className="h-4 w-4" />,
    color: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400",
    label: "Payment Failed",
    href: () => "/billing/repeat-charges"
  },
  message_received: {
    icon: <MessageSquare className="h-4 w-4" />,
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400",
    label: "Message",
    href: () => "/messages"
  },
  general: {
    icon: <Bell className="h-4 w-4" />,
    color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
    label: "General",
    href: () => "/dashboard"
  }
};

export default function NotificationsPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const prefersReducedMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const [typeFilter, setTypeFilter] = useState<NotificationType | "all">("all");

  const userId = session?.user?.id;

  const { data: notifications = [], isLoading, error } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => apiClient.getNotifications(userId!, { limit: 100 }),
    enabled: !!userId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => apiClient.markNotificationRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    }
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiClient.markAllNotificationsRead(userId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    }
  });

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === "unread" && n.readAt) return false;
    if (typeFilter !== "all" && n.type !== typeFilter) return false;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const todayCount = notifications.filter((n) => {
    const created = new Date(n.createdAt);
    const today = new Date();
    return created.toDateString() === today.toDateString();
  }).length;

  const animationVariants = prefersReducedMotion ? reducedMotionVariants : fadeInUp;

  if (!session) {
    return (
      <DashboardShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="max-w-lg border-border bg-card">
            <CardHeader>
              <CardTitle>Sign in required</CardTitle>
              <CardDescription>Please sign in to view your notifications.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <motion.div
        className="space-y-6"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {/* Header */}
        <motion.div
          className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
          {...animationVariants}
          transition={SPRING_CONFIG}
        >
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Bell className="h-8 w-8 text-emerald-500" />
              Notifications
            </h1>
            <p className="text-muted-foreground mt-1">
              Stay updated on bookings, payments, messages, and operations
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="gap-2"
              >
                {markAllReadMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCheck className="h-4 w-4" />
                )}
                Mark all read
              </Button>
            )}
            <Link href="/dashboard/settings/notifications">
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          {...animationVariants}
          transition={{ ...SPRING_CONFIG, delay: 0.1 }}
        >
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-foreground">{notifications.length}</div>
                  <div className="text-sm text-muted-foreground">Total notifications</div>
                </div>
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Bell className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={cn("border-border", unreadCount > 0 ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-card")}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-foreground">{unreadCount}</div>
                  <div className="text-sm text-muted-foreground">Unread</div>
                </div>
                <div className={cn(
                  "h-12 w-12 rounded-full flex items-center justify-center",
                  unreadCount > 0 ? "bg-emerald-100 dark:bg-emerald-900/50" : "bg-muted"
                )}>
                  <Bell className={cn("h-6 w-6", unreadCount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-foreground">{todayCount}</div>
                  <div className="text-sm text-muted-foreground">Today</div>
                </div>
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filters */}
        <motion.div
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          {...animationVariants}
          transition={{ ...SPRING_CONFIG, delay: 0.15 }}
        >
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "all" | "unread")}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread" className="gap-2">
                Unread
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="ml-1">{unreadCount}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="flex gap-1 flex-wrap">
              <Button
                variant={typeFilter === "all" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setTypeFilter("all")}
              >
                All types
              </Button>
              {(["arrival", "departure", "payment_received", "message_received", "task_assigned"] as NotificationType[]).map((type) => (
                <Button
                  key={type}
                  variant={typeFilter === type ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setTypeFilter(type)}
                  className="gap-1"
                >
                  {typeConfig[type].icon}
                  <span className="hidden sm:inline">{typeConfig[type].label}</span>
                </Button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Notification List */}
        <motion.div
          {...animationVariants}
          transition={{ ...SPRING_CONFIG, delay: 0.2 }}
        >
          <Card className="border-border bg-card">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
                  <p className="text-lg font-medium text-foreground">Failed to load notifications</p>
                  <p className="text-sm text-muted-foreground">Please try again later</p>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <BellOff className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium text-foreground">
                    {activeTab === "unread" ? "No unread notifications" : "No notifications yet"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {activeTab === "unread"
                      ? "You're all caught up!"
                      : "Notifications about bookings, payments, and more will appear here"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredNotifications.map((notification, index) => {
                    const config = typeConfig[notification.type as NotificationType] || typeConfig.general;
                    const isUnread = !notification.readAt;
                    const href = config.href?.(notification.data);

                    return (
                      <motion.div
                        key={notification.id}
                        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ...SPRING_CONFIG, delay: getStaggerDelay(index) }}
                        className={cn(
                          "flex items-start gap-4 p-4 transition-colors",
                          isUnread ? "bg-emerald-50/50 dark:bg-emerald-950/20" : "hover:bg-muted/50"
                        )}
                      >
                        {/* Icon */}
                        <div className={cn("flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center", config.color)}>
                          {config.icon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">{notification.title}</span>
                                {isUnread && (
                                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-0.5">{notification.body}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {config.label}
                            </Badge>
                            {href && (
                              <Link
                                href={href}
                                className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-1"
                                onClick={() => {
                                  if (isUnread) {
                                    markReadMutation.mutate(notification.id);
                                  }
                                }}
                              >
                                View <ChevronRight className="h-3 w-3" />
                              </Link>
                            )}
                            {isUnread && (
                              <button
                                onClick={() => markReadMutation.mutate(notification.id)}
                                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                disabled={markReadMutation.isPending}
                              >
                                <Check className="h-3 w-3" />
                                Mark read
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Empty state hint for testing */}
        {notifications.length === 0 && !isLoading && (
          <motion.div
            {...animationVariants}
            transition={{ ...SPRING_CONFIG, delay: 0.25 }}
          >
            <Card className="border-dashed border-2 border-border bg-muted/30">
              <CardContent className="py-8">
                <div className="text-center">
                  <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Notifications are triggered by system events like new bookings, payments, check-ins, and messages.
                    As activity occurs, you'll see notifications appear here.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </DashboardShell>
  );
}
