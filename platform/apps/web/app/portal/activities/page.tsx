"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Calendar, Clock, Users, DollarSign, Ticket, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { recordTelemetry } from "../../../lib/sync-telemetry";
import { loadQueue as loadQueueGeneric, saveQueue as saveQueueGeneric, registerBackgroundSync } from "../../../lib/offline-queue";
import { randomId } from "@/lib/random-id";
import { TableEmpty } from "@/components/ui/table";

export default function GuestActivitiesPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
    const [selectedSession, setSelectedSession] = useState<string | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [isBookOpen, setIsBookOpen] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const activitiesCacheKey = "campreserv:portalActivities";
    const sessionsCacheKey = (activityId: string) => `campreserv:portalActivitySessions:${activityId}`;
    const activityQueueKey = "campreserv:portal:activityQueue";
    const [queuedBookings, setQueuedBookings] = useState(0);
    const [conflicts, setConflicts] = useState<any[]>([]);

    // Get campground ID from localStorage
    const [campgroundId, setCampgroundId] = useState<string>("");
    // Guest ID would come from guest auth token - for now, try to get from reservation context
    const [guestId, setGuestId] = useState<string>("");

    useEffect(() => {
        if (typeof window === "undefined") return;
        setIsOnline(navigator.onLine);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        recordTelemetry({ source: "portal-activities", type: "sync", status: navigator.onLine ? "success" : "pending", message: navigator.onLine ? "Online" : "Offline" });
        try {
            const raw = localStorage.getItem(activityQueueKey);
            const parsed = raw ? JSON.parse(raw) : [];
            const list = Array.isArray(parsed) ? parsed : [];
            setQueuedBookings(list.length);
            setConflicts(list.filter((i) => i?.conflict));
        } catch {
            setQueuedBookings(0);
        }

        const storedCg = localStorage.getItem("campreserv:selectedCampground");
        if (storedCg) setCampgroundId(storedCg);
        const storedGuestToken = localStorage.getItem("campreserv:guestToken");
        if (storedGuestToken) {
            try {
                const payload = JSON.parse(atob(storedGuestToken.split('.')[1]));
                if (payload.guestId) setGuestId(payload.guestId);
            } catch (e) {
                console.warn("Could not decode guest token");
            }
        }

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    const loadQueue = () => loadQueueGeneric<any>(activityQueueKey);
    const saveQueue = (items: any[]) => {
        saveQueueGeneric(activityQueueKey, items);
        setQueuedBookings(items.length);
        setConflicts(items.filter((i) => i?.conflict));
    };

    const queueBooking = (sessionId: string, payload: any) => {
        const item = {
            id: randomId(),
            sessionId,
            payload,
            attempt: 0,
            nextAttemptAt: Date.now(),
            createdAt: new Date().toISOString(),
            lastError: null,
            idempotencyKey: randomId(),
            conflict: false,
        };
        const updated = [...loadQueue(), item];
        saveQueue(updated);
        void registerBackgroundSync();
    };

    const flushQueue = async () => {
        if (!navigator.onLine) return;
        const now = Date.now();
        const items = loadQueue();
        if (!items.length) return;
        const remaining: any[] = [];
        for (const item of items) {
            if (item.nextAttemptAt && item.nextAttemptAt > now) {
                remaining.push(item);
                continue;
            }
            try {
                await apiClient.bookActivity(item.sessionId, item.payload);
                recordTelemetry({ source: "portal-activities", type: "sync", status: "success", message: "Queued booking flushed", meta: { sessionId: item.sessionId } });
            } catch (err: any) {
                const attempt = (item.attempt ?? 0) + 1;
                const delay = Math.min(300000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 500);
                const isConflict = err?.status === 409 || err?.status === 412 || /conflict/i.test(err?.message ?? "");
                remaining.push({ ...item, attempt, nextAttemptAt: Date.now() + delay, lastError: err?.message, conflict: isConflict });
                recordTelemetry({
                    source: "portal-activities",
                    type: isConflict ? "conflict" : "error",
                    status: isConflict ? "conflict" : "failed",
                    message: isConflict ? "Booking conflict, needs review" : "Flush failed, retry scheduled",
                    meta: { error: err?.message },
                });
            }
        }
        saveQueue(remaining);
    };

    useEffect(() => {
        if (isOnline) {
            void flushQueue();
        }
    }, [isOnline]);

    useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.data?.type === "SYNC_QUEUES") {
                void flushQueue();
            }
        };
        navigator.serviceWorker?.addEventListener("message", handler);
        return () => navigator.serviceWorker?.removeEventListener("message", handler);
    }, []);

    const retryConflict = (id: string) => {
        const items = loadQueue().map((i) => (i.id === id ? { ...i, conflict: false, nextAttemptAt: Date.now() } : i));
        saveQueue(items);
        void flushQueue();
    };

    const discardConflict = (id: string) => {
        const items = loadQueue().filter((i) => i.id !== id);
        saveQueue(items);
    };

    const { data: activities, isLoading } = useQuery({
        queryKey: ["activities", campgroundId],
        queryFn: async () => {
            const data = await apiClient.getActivities(campgroundId);
            try {
                localStorage.setItem(activitiesCacheKey, JSON.stringify(data));
                recordTelemetry({ source: "portal-activities", type: "cache", status: "success", message: "Activities cached", meta: { count: data.length } });
            } catch {
                // ignore
            }
            return data;
        },
        enabled: !!campgroundId,
        staleTime: 1000 * 60 * 5,
        retry: isOnline ? 3 : false,
        initialData: () => {
            if (typeof window === "undefined") return undefined;
            try {
                const raw = localStorage.getItem(activitiesCacheKey);
                return raw ? JSON.parse(raw) : undefined;
            } catch {
                recordTelemetry({ source: "portal-activities", type: "error", status: "failed", message: "Failed to load cached activities" });
                return undefined;
            }
        }
    });

    const { data: sessions } = useQuery({
        queryKey: ["sessions", selectedActivity],
        queryFn: async () => {
            if (!selectedActivity) return [];
            const data = await apiClient.getSessions(selectedActivity);
            try {
                localStorage.setItem(sessionsCacheKey(selectedActivity), JSON.stringify(data));
                recordTelemetry({ source: "portal-activities", type: "cache", status: "success", message: "Sessions cached", meta: { activityId: selectedActivity, count: data.length } });
            } catch {
                // ignore
            }
            return data;
        },
        enabled: !!selectedActivity,
        staleTime: 1000 * 60 * 2,
        retry: isOnline ? 2 : false,
        initialData: () => {
            if (!selectedActivity || typeof window === "undefined") return undefined;
            try {
                const raw = localStorage.getItem(sessionsCacheKey(selectedActivity));
                return raw ? JSON.parse(raw) : undefined;
            } catch {
                recordTelemetry({ source: "portal-activities", type: "error", status: "failed", message: "Failed to load cached sessions", meta: { activityId: selectedActivity } });
                return undefined;
            }
        }
    });

    const bookMutation = useMutation({
        mutationFn: async () => {
            if (!selectedSession) throw new Error("No session selected");
            const payload = { guestId, quantity };
            if (!isOnline) {
                queueBooking(selectedSession, payload);
                recordTelemetry({ source: "portal-activities", type: "queue", status: "pending", message: "Booking queued offline", meta: { sessionId: selectedSession } });
                return { queued: true };
            }
            return apiClient.bookActivity(selectedSession, payload);
        },
        onSuccess: (res: any) => {
            if (!(res as any)?.queued) {
                queryClient.invalidateQueries({ queryKey: ["sessions", selectedActivity] });
                toast({ title: "Booking confirmed!", description: "We've sent you a confirmation email." });
                recordTelemetry({ source: "portal-activities", type: "sync", status: "success", message: "Booking completed", meta: { sessionId: selectedSession } });
            } else {
                toast({ title: "Booking saved offline", description: "We'll submit it when you're back online." });
            }
            setIsBookOpen(false);
            setSelectedActivity(null);
            setSelectedSession(null);
            setQuantity(1);
        },
        onError: (err) => {
            if (!selectedSession) return;
            queueBooking(selectedSession, { guestId, quantity });
            toast({ title: "Booking saved offline", description: "We'll retry shortly.", variant: "default" });
            recordTelemetry({ source: "portal-activities", type: "error", status: "failed", message: "Booking failed, queued", meta: { error: (err as any)?.message } });
        }
    });

    if (isLoading) {
        return <div className="p-8 text-center">Loading activities...</div>;
    }

    return (
        <div className="container mx-auto px-4 py-6 space-y-6">
            {/* Page Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between flex-wrap gap-4"
            >
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                        <Sparkles className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Activities & Events</h1>
                        <p className="text-muted-foreground">Enhance your stay with curated experiences</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {!isOnline && <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-1 text-xs text-muted-foreground">Offline</span>}
                    {queuedBookings > 0 && (
                        <span
                            className="inline-flex items-center rounded-full border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 text-xs text-amber-800 dark:text-amber-300"
                            title={
                                conflicts.length
                                    ? `${queuedBookings - conflicts.length} queued, ${conflicts.length} conflicts${conflicts[0]?.lastError ? ` (last error: ${conflicts[0].lastError})` : ""}${
                                          queuedBookings > conflicts.length
                                              ? ` • next retry ${new Date(
                                                    Math.min(
                                                        ...loadQueue()
                                                            .map((i) => i.nextAttemptAt)
                                                            .filter((n) => typeof n === "number")
                                                    )
                                                ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                                              : ""
                                      }`
                                    : `${queuedBookings} queued`
                            }
                        >
                            {queuedBookings} queued
                        </span>
                    )}
                </div>
            </motion.div>
            {conflicts.length > 0 && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-300 p-3 text-sm space-y-2">
                    <div className="font-semibold">Conflicts detected</div>
                    {conflicts.map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs">Booking {c.id.slice(0, 8)}…</span>
                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="secondary" onClick={() => retryConflict(c.id)}>
                                    Retry
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => discardConflict(c.id)}>
                                    Discard
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {!isOnline && (
                <Alert>
                    <AlertTitle>Offline mode</AlertTitle>
                    <AlertDescription>
                        Showing cached activities and sessions. Booking requires a connection. Queued: {queuedBookings}
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activities?.filter((a: any) => a.isActive).map((activity: any) => (
                    <Card key={activity.id} className="flex flex-col">
                        {activity.images[0] && (
                            <div className="h-48 w-full bg-slate-200 relative">
                                <img src={activity.images[0]} alt={activity.name} className="object-cover w-full h-full rounded-t-lg" />
                            </div>
                        )}
                        <CardHeader>
                            <CardTitle>{activity.name}</CardTitle>
                            <CardDescription className="line-clamp-3">
                                {activity.description}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <div className="space-y-2 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    <span>{activity.duration} minutes</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <DollarSign className="w-4 h-4" />
                                    <span className="font-semibold text-foreground">${(activity.price / 100).toFixed(2)}</span> per person
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Dialog open={isBookOpen && selectedActivity === activity.id} onOpenChange={(open) => {
                                setIsBookOpen(open);
                                if (open) setSelectedActivity(activity.id);
                                else {
                                    setSelectedActivity(null);
                                    setSelectedSession(null);
                                }
                            }}>
                                <DialogTrigger asChild>
                                    <Button className="w-full">Book Now</Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Book {activity.name}</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>Select a Session</Label>
                                            <div className="grid gap-2 max-h-60 overflow-y-auto">
                                                {sessions?.filter((s: any) => s.status === "scheduled").map((session: any) => (
                                                    <div
                                                        key={session.id}
                                                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedSession === session.id ? "border-blue-500 bg-blue-50" : "hover:bg-slate-50"}`}
                                                        onClick={() => setSelectedSession(session.id)}
                                                    >
                                                        <div className="flex justify-between items-center">
                                                            <div className="font-medium">
                                                                {format(new Date(session.startTime), "MMM d, h:mm a")}
                                                            </div>
                                                            <div className="text-sm text-slate-500">
                                                                {session.capacity - session.bookedCount} spots left
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {sessions?.length === 0 && (
                                                    <div className="overflow-hidden rounded border border-slate-200 bg-white">
                                                        <table className="w-full text-sm">
                                                            <tbody>
                                                                <TableEmpty>No upcoming sessions available.</TableEmpty>
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {selectedSession && (
                                            <div className="space-y-2">
                                                <Label>Number of Tickets</Label>
                                                <div className="flex items-center gap-4">
                                                    <Button variant="outline" size="icon" onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</Button>
                                                    <span className="text-lg font-medium w-8 text-center">{quantity}</span>
                                                    <Button variant="outline" size="icon" onClick={() => setQuantity(quantity + 1)}>+</Button>
                                                </div>
                                                <div className="text-right font-medium text-lg">
                                                    Total: ${((activity.price * quantity) / 100).toFixed(2)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <DialogFooter>
                                        <Button variant="ghost" onClick={() => setIsBookOpen(false)}>Cancel</Button>
                                        <Button onClick={() => bookMutation.mutate()} disabled={!selectedSession || bookMutation.isPending || !isOnline}>
                                            {bookMutation.isPending ? "Booking..." : isOnline ? "Confirm Booking" : "Reconnect to book"}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
