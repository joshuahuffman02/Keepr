"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Activity,
  Users,
  Eye,
  MousePointer,
  Search,
  AlertTriangle,
  RefreshCw,
  Pause,
  Play,
  Zap,
  Clock,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
} from "lucide-react";
import Link from "next/link";
import { z } from "zod";

interface LiveEvent {
  id: string;
  sessionId: string;
  userId: string | null;
  guestId: string | null;
  actorType: "staff" | "guest" | "system";
  eventType: string;
  eventData: Record<string, unknown>;
  page: string | null;
  createdAt: string;
  expiresAt: string;
}

const LiveEventSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  userId: z.string().nullable(),
  guestId: z.string().nullable(),
  actorType: z.enum(["staff", "guest", "system"]),
  eventType: z.string(),
  eventData: z.record(z.unknown()),
  page: z.string().nullable(),
  createdAt: z.string(),
  expiresAt: z.string(),
});
const LiveEventArraySchema = z.array(LiveEventSchema);

interface SessionStats {
  activeSessions: number;
  staffSessions: number;
  guestSessions: number;
  avgSessionDuration: number;
  deviceBreakdown: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
}

const SessionStatsSchema = z.object({
  activeSessions: z.number(),
  staffSessions: z.number(),
  guestSessions: z.number(),
  avgSessionDuration: z.number(),
  deviceBreakdown: z.object({
    desktop: z.number(),
    mobile: z.number(),
    tablet: z.number(),
  }),
});

function getEventIcon(eventType: string) {
  switch (eventType) {
    case "page_view":
    case "admin_page_view":
      return <Eye className="h-4 w-4 text-blue-500" />;
    case "click":
    case "admin_action":
      return <MousePointer className="h-4 w-4 text-green-500" />;
    case "search":
    case "admin_search":
      return <Search className="h-4 w-4 text-purple-500" />;
    case "error":
    case "admin_error":
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case "session_start":
    case "admin_session_start":
      return <Play className="h-4 w-4 text-emerald-500" />;
    case "session_end":
    case "admin_session_end":
      return <Pause className="h-4 w-4 text-gray-500" />;
    default:
      return <Activity className="h-4 w-4 text-gray-400" />;
  }
}

function getEventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    page_view: "Page View",
    admin_page_view: "Admin Page View",
    click: "Click",
    admin_action: "Action",
    search: "Search",
    admin_search: "Admin Search",
    error: "Error",
    admin_error: "Admin Error",
    session_start: "Session Started",
    admin_session_start: "Staff Login",
    session_end: "Session Ended",
    admin_session_end: "Staff Logout",
    form_submit: "Form Submit",
    reservation_create: "Reservation Created",
    check_in: "Check In",
    check_out: "Check Out",
    payment: "Payment",
  };
  return labels[eventType] || eventType.replace(/_/g, " ");
}

function getActorBadge(actorType: string) {
  switch (actorType) {
    case "staff":
      return <Badge variant="default" className="text-xs">Staff</Badge>;
    case "guest":
      return <Badge variant="secondary" className="text-xs">Guest</Badge>;
    case "system":
      return <Badge variant="outline" className="text-xs">System</Badge>;
    default:
      return null;
  }
}

function getDeviceIcon(device: string) {
  switch (device) {
    case "mobile":
      return <Smartphone className="h-4 w-4" />;
    case "tablet":
      return <Tablet className="h-4 w-4" />;
    default:
      return <Monitor className="h-4 w-4" />;
  }
}

function formatTimeAgo(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffSecs = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (diffSecs < 5) return "just now";
  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
  return `${Math.floor(diffSecs / 3600)}h ago`;
}

export default function LiveActivityFeed() {
  const { campgroundId } = useAuth();
  const [isLive, setIsLive] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterActor, setFilterActor] = useState("all");

  const { data: liveEvents, isLoading: eventsLoading, refetch: refetchEvents } = useQuery<LiveEvent[]>({
    queryKey: ["analytics-live-events", campgroundId],
    queryFn: async () => {
      const response = await apiClient.get<LiveEvent[]>(`/analytics/enhanced/live`, {
        params: { campgroundId, limit: 100 },
        schema: LiveEventArraySchema,
      });
      return response.data;
    },
    enabled: !!campgroundId,
    refetchInterval: isLive ? 5000 : false, // Refresh every 5 seconds when live
  });

  const { data: sessionStats, isLoading: statsLoading } = useQuery<SessionStats>({
    queryKey: ["analytics-session-stats", campgroundId],
    queryFn: async () => {
      const response = await apiClient.get<SessionStats>(`/analytics/enhanced/reports/sessions`, {
        params: { campgroundId, days: 1 },
        schema: SessionStatsSchema,
      });
      return response.data;
    },
    enabled: !!campgroundId,
    refetchInterval: isLive ? 30000 : false, // Refresh every 30 seconds when live
  });

  // Filter events
  const filteredEvents = liveEvents?.filter((event) => {
    if (filterType !== "all" && event.eventType !== filterType) return false;
    if (filterActor !== "all" && event.actorType !== filterActor) return false;
    return true;
  }) || [];

  // Get unique event types for filter
  const eventTypes = [...new Set(liveEvents?.map((e) => e.eventType) || [])];

  // Count events by type
  const eventCounts =
    liveEvents?.reduce<Record<string, number>>((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {}) || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/analytics">
            <Button variant="ghost" size="icon" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              Live Activity Feed
              {isLive && (
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              )}
            </h1>
            <p className="text-muted-foreground">
              Real-time view of all activity
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="live-mode"
              checked={isLive}
              onCheckedChange={setIsLive}
            />
            <Label htmlFor="live-mode" className="text-sm">
              {isLive ? "Live" : "Paused"}
            </Label>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchEvents()}
            disabled={isLive}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{sessionStats?.activeSessions || 0}</div>
                <div className="flex gap-2 mt-1">
                  <Badge variant="default" className="text-xs">
                    {sessionStats?.staffSessions || 0} staff
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {sessionStats?.guestSessions || 0} guests
                  </Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Events (5m)</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {eventsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{liveEvents?.length || 0}</div>
                <p className="text-xs text-muted-foreground">Live events</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Session</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {sessionStats?.avgSessionDuration
                    ? `${Math.round(sessionStats.avgSessionDuration)}m`
                    : "-"}
                </div>
                <p className="text-xs text-muted-foreground">Duration</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Devices</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {sessionStats?.deviceBreakdown?.desktop || 0}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {sessionStats?.deviceBreakdown?.mobile || 0}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Tablet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {sessionStats?.deviceBreakdown?.tablet || 0}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event Type Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Event Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(eventCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <Badge
                  key={type}
                  variant={filterType === type ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setFilterType(filterType === type ? "all" : type)}
                >
                  {getEventIcon(type)}
                  <span className="ml-1">{getEventLabel(type)}</span>
                  <span className="ml-1 text-muted-foreground">({count})</span>
                </Badge>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters and Feed */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Filters */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Event Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  {eventTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {getEventLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Actor Type</Label>
              <Select value={filterActor} onValueChange={setFilterActor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actors</SelectItem>
                  <SelectItem value="staff">Staff Only</SelectItem>
                  <SelectItem value="guest">Guests Only</SelectItem>
                  <SelectItem value="system">System Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(filterType !== "all" || filterActor !== "all") && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setFilterType("all");
                  setFilterActor("all");
                }}
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Event Feed */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Activity Feed</span>
              <span className="text-xs text-muted-foreground font-normal">
                {filteredEvents.length} events
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {eventsLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                No events found
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="divide-y">
                  {filteredEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="mt-0.5">
                        {getEventIcon(event.eventType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">
                            {getEventLabel(event.eventType)}
                          </span>
                          {getActorBadge(event.actorType)}
                          <span className="text-xs text-muted-foreground">
                            {formatTimeAgo(event.createdAt)}
                          </span>
                        </div>
                        {event.page && (
                          <p className="text-sm text-muted-foreground truncate mt-0.5">
                            {event.page}
                          </p>
                        )}
                        {event.eventData && Object.keys(event.eventData).length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {Object.entries(event.eventData).slice(0, 3).map(([key, value]) => (
                              <Badge key={key} variant="outline" className="text-xs">
                                {key}: {String(value).slice(0, 20)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {event.sessionId.slice(0, 8)}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
