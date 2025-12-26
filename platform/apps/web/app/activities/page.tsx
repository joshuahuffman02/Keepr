// @ts-nocheck
"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "../../components/ui/layout/DashboardShell";
import { apiClient } from "../../lib/api-client";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import {
    Plus, Calendar, Clock, Users, DollarSign, Trash2, LayoutGrid, Loader2,
    Image as ImageIcon, Sparkles, PartyPopper, MapPin, CheckCircle2, Upload,
    ChevronRight, Star, Tent, Music, Utensils, TreePine, Waves, Sun
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { useToast } from "../../components/ui/use-toast";
import { Badge } from "../../components/ui/badge";
import { Switch } from "../../components/ui/switch";
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { CreateEventDialog } from "../../components/events/CreateEventDialog";
import { Event } from "@campreserv/shared";
import { cn } from "../../lib/utils";
import { Skeleton } from "../../components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

const locales = {
    "en-US": enUS,
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
});

type ActivityRecord = {
    id: string;
    name: string;
    description?: string | null;
    price: number;
    duration: number;
    capacity: number;
    isActive: boolean;
    imageUrl?: string | null;
    category?: string | null;
};

type CapacitySnapshot = {
    activityId: string;
    capacity: number;
    booked: number;
    remaining: number;
    waitlistEnabled: boolean;
    waitlistCount: number;
    overage: boolean;
    overageAmount: number;
    lastUpdated: string;
};

// Category icons for visual variety
const categoryIcons: Record<string, React.ReactNode> = {
    recreation: <Tent className="h-5 w-5" />,
    music: <Music className="h-5 w-5" />,
    food: <Utensils className="h-5 w-5" />,
    nature: <TreePine className="h-5 w-5" />,
    water: <Waves className="h-5 w-5" />,
    default: <Sun className="h-5 w-5" />
};

// Loading skeleton for activity cards
function ActivityCardSkeleton() {
    return (
        <Card className="overflow-hidden">
            <Skeleton className="h-40 w-full" />
            <CardHeader className="pb-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex gap-4">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-10 w-full" />
            </CardContent>
        </Card>
    );
}

// Enhanced Activity Card with image support
function ActivityCard({
    activity,
    onManageSessions,
    onDelete
}: {
    activity: ActivityRecord;
    onManageSessions: (id: string) => void;
    onDelete: (id: string) => void;
}) {
    const { toast } = useToast();
    const [isHovered, setIsHovered] = useState(false);

    const capacityQuery = useQuery<CapacitySnapshot>({
        queryKey: ["activityCapacity", activity.id],
        queryFn: () => apiClient.getActivityCapacity(activity.id),
    });

    const snapshot = capacityQuery.data;
    const icon = categoryIcons[activity.category || "default"] || categoryIcons.default;

    return (
        <Card
            className={cn(
                "group overflow-hidden transition-all duration-300 cursor-pointer",
                "hover:shadow-xl hover:-translate-y-1",
                "focus-within:ring-2 focus-within:ring-emerald-500 focus-within:ring-offset-2"
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Image or Placeholder */}
            <div className="relative h-40 bg-gradient-to-br from-emerald-100 to-teal-50 overflow-hidden">
                {activity.imageUrl ? (
                    <img
                        src={activity.imageUrl}
                        alt=""
                        className={cn(
                            "w-full h-full object-cover transition-transform duration-500",
                            isHovered && "scale-110"
                        )}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className={cn(
                            "p-6 rounded-full bg-white/80 text-emerald-600 transition-transform duration-300",
                            isHovered && "scale-110"
                        )}>
                            {icon}
                        </div>
                    </div>
                )}

                {/* Status badge */}
                <div className="absolute top-3 right-3">
                    <Badge
                        variant={activity.isActive ? "default" : "secondary"}
                        className={cn(
                            "transition-all duration-200",
                            activity.isActive
                                ? "bg-emerald-500 hover:bg-emerald-600"
                                : "bg-slate-400"
                        )}
                    >
                        {activity.isActive ? "Active" : "Inactive"}
                    </Badge>
                </div>

                {/* Capacity indicator */}
                {snapshot && (
                    <div className="absolute bottom-3 left-3">
                        <div className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm",
                            snapshot.remaining > 5
                                ? "bg-emerald-500/90 text-white"
                                : snapshot.remaining > 0
                                    ? "bg-amber-500/90 text-white"
                                    : "bg-red-500/90 text-white"
                        )}>
                            {snapshot.remaining > 0
                                ? `${snapshot.remaining} spots left`
                                : "Fully booked"}
                        </div>
                    </div>
                )}

                {/* Hover overlay */}
                <div className={cn(
                    "absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent",
                    "opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                    "flex items-end justify-center pb-4"
                )}>
                    <Button
                        size="sm"
                        className="bg-white text-slate-900 hover:bg-slate-100 shadow-lg"
                        onClick={() => onManageSessions(activity.id)}
                    >
                        <Calendar className="h-4 w-4 mr-1.5" />
                        Manage Sessions
                    </Button>
                </div>
            </div>

            <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg leading-tight">{activity.name}</CardTitle>
                </div>
                <CardDescription className="line-clamp-2 text-sm">
                    {activity.description || "No description provided"}
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Quick stats */}
                <div className="flex items-center gap-4 text-sm text-slate-600">
                    <div className="flex items-center gap-1.5">
                        <DollarSign className="h-4 w-4 text-emerald-600" />
                        <span className="font-medium">${(activity.price / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-slate-400" />
                        <span>{activity.duration} mins</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-slate-400" />
                        <span>Max {activity.capacity}</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                    <Button
                        variant="outline"
                        className="flex-1 group/btn"
                        onClick={() => onManageSessions(activity.id)}
                    >
                        <span>Sessions</span>
                        <ChevronRight className="h-4 w-4 ml-1 transition-transform group-hover/btn:translate-x-0.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        onClick={() => {
                            if (confirm("Delete this activity? This cannot be undone.")) {
                                onDelete(activity.id);
                            }
                        }}
                        aria-label={`Delete ${activity.name}`}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

// Success celebration modal
function SuccessCelebration({
    open,
    onClose,
    activityName
}: {
    open: boolean;
    onClose: () => void;
    activityName: string;
}) {
    useEffect(() => {
        if (open) {
            const timer = setTimeout(onClose, 3000);
            return () => clearTimeout(timer);
        }
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-2xl shadow-2xl p-8 text-center motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:fade-in duration-300">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white mb-4 motion-safe:animate-bounce">
                    <PartyPopper className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                    Activity Created!
                </h3>
                <p className="text-slate-600">
                    <span className="font-medium text-emerald-600">{activityName}</span> is ready for guests to enjoy
                </p>
                <div className="flex items-center justify-center gap-1 mt-3 text-sm text-slate-500">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <span>Time to schedule some sessions!</span>
                </div>
            </div>
        </div>
    );
}

// Empty state component
function EmptyActivitiesState({ onCreateClick }: { onCreateClick: () => void }) {
    return (
        <div className="col-span-full">
            <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white p-12 text-center">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-100/50 to-teal-100/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-br from-amber-100/50 to-orange-100/50 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

                <div className="relative">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-600 mb-6">
                        <Sparkles className="h-10 w-10" />
                    </div>

                    <h3 className="text-2xl font-bold text-slate-900 mb-3">
                        Create Your First Activity
                    </h3>
                    <p className="text-slate-600 max-w-md mx-auto mb-8">
                        Activities make your campground memorable! Add guided tours, yoga sessions,
                        kayak rentals, or campfire nights for your guests to enjoy.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Button
                            size="lg"
                            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5"
                            onClick={onCreateClick}
                        >
                            <Plus className="h-5 w-5 mr-2" />
                            Create Activity
                        </Button>
                    </div>

                    {/* Example activities */}
                    <div className="mt-10 flex flex-wrap justify-center gap-3">
                        {["Morning Yoga", "Kayak Rental", "Campfire Night", "Nature Hike", "Fishing Trip"].map((name) => (
                            <span
                                key={name}
                                className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-sm text-slate-600 shadow-sm"
                            >
                                {name}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ActivitiesPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [viewMode, setViewMode] = useState<"cards" | "calendar">("cards");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
    const [showCelebration, setShowCelebration] = useState(false);
    const [celebrationName, setCelebrationName] = useState("");
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [newActivity, setNewActivity] = useState({
        name: "",
        description: "",
        price: "",
        duration: "",
        capacity: "",
        imageUrl: "",
        category: "recreation"
    });

    const [selectedActivityForSessions, setSelectedActivityForSessions] = useState<string | null>(null);
    const [newSession, setNewSession] = useState({
        startTime: "",
        endTime: "",
        capacity: ""
    });

    // Get campground ID from localStorage
    const [campgroundId, setCampgroundId] = useState<string>("");

    useEffect(() => {
        if (typeof window === "undefined") return;
        const stored = localStorage.getItem("campreserv:selectedCampground");
        if (stored) setCampgroundId(stored);
    }, []);

    const { data: activities, isLoading } = useQuery({
        queryKey: ["activities", campgroundId],
        queryFn: () => apiClient.getActivities(campgroundId),
        enabled: !!campgroundId
    });

    const { data: events, isLoading: eventsLoading } = useQuery<Event[]>({
        queryKey: ["events", campgroundId],
        queryFn: () => apiClient.getEvents(campgroundId),
        enabled: !!campgroundId && viewMode === "calendar"
    });

    const { data: sessions, refetch: refetchSessions } = useQuery({
        queryKey: ["sessions", selectedActivityForSessions],
        queryFn: () => selectedActivityForSessions ? apiClient.getSessions(selectedActivityForSessions) : Promise.resolve([]),
        enabled: !!selectedActivityForSessions
    });

    const createSessionMutation = useMutation({
        mutationFn: async () => {
            if (!selectedActivityForSessions) throw new Error("No activity selected");
            return apiClient.createSession(selectedActivityForSessions, {
                startTime: new Date(newSession.startTime).toISOString(),
                endTime: new Date(newSession.endTime).toISOString(),
                capacity: newSession.capacity ? parseInt(newSession.capacity) : undefined
            });
        },
        onSuccess: () => {
            refetchSessions();
            setNewSession({ startTime: "", endTime: "", capacity: "" });
            toast({ title: "Session scheduled", description: "Guests can now book this time slot!" });
        },
        onError: () => {
            toast({ title: "Failed to schedule session", variant: "destructive" });
        }
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            return apiClient.createActivity(campgroundId, {
                ...newActivity,
                price: parseFloat(newActivity.price) * 100,
                duration: parseInt(newActivity.duration),
                capacity: parseInt(newActivity.capacity),
                imageUrl: newActivity.imageUrl || undefined
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["activities", campgroundId] });
            setCelebrationName(newActivity.name);
            setShowCelebration(true);
            setIsCreateOpen(false);
            setNewActivity({ name: "", description: "", price: "", duration: "", capacity: "", imageUrl: "", category: "recreation" });
            toast({ title: "Activity created!", description: "Now schedule some sessions to get started." });
        },
        onError: () => {
            toast({ title: "Failed to create activity", variant: "destructive" });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            return apiClient.deleteActivity(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["activities", campgroundId] });
            toast({ title: "Activity deleted" });
        }
    });

    const selectedActivity = activities?.find((a) => a.id === selectedActivityForSessions);

    const handleDelete = (id: string) => {
        deleteMutation.mutate(id);
    };

    const handleImageUpload = async (file: File) => {
        setUploading(true);
        try {
            const signed = await apiClient.signUpload({ filename: file.name, contentType: file.type });
            await fetch(signed.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
            setNewActivity((s) => ({ ...s, imageUrl: signed.publicUrl }));
            toast({ title: "Image uploaded!" });
        } catch (err) {
            toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };

    const calendarEvents = events?.map(event => ({
        id: event.id,
        title: event.title,
        start: new Date(event.startDate),
        end: event.endDate ? new Date(event.endDate) : new Date(event.startDate),
        allDay: event.isAllDay,
        resource: event
    })) || [];

    const handleSelectEvent = (event: any) => {
        console.log("Selected event:", event);
    };

    return (
        <DashboardShell>
            {/* Success Celebration */}
            <SuccessCelebration
                open={showCelebration}
                onClose={() => setShowCelebration(false)}
                activityName={celebrationName}
            />

            {/* Session Management Dialog */}
            <Dialog open={!!selectedActivityForSessions} onOpenChange={(open) => !open && setSelectedActivityForSessions(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-emerald-600" />
                            Manage Sessions {selectedActivity ? `– ${selectedActivity.name}` : ""}
                        </DialogTitle>
                        <DialogDescription>Schedule upcoming sessions for guests to book.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        <div className="border rounded-lg p-4 bg-gradient-to-br from-emerald-50 to-teal-50 space-y-4">
                            <h4 className="font-medium text-sm flex items-center gap-2">
                                <Plus className="h-4 w-4" />
                                Schedule New Session
                            </h4>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="session-start">Start Time</Label>
                                    <Input
                                        id="session-start"
                                        type="datetime-local"
                                        value={newSession.startTime}
                                        onChange={(e) => setNewSession({ ...newSession, startTime: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="session-end">End Time</Label>
                                    <Input
                                        id="session-end"
                                        type="datetime-local"
                                        value={newSession.endTime}
                                        onChange={(e) => setNewSession({ ...newSession, endTime: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="session-capacity">Capacity (Optional)</Label>
                                    <Input
                                        id="session-capacity"
                                        type="number"
                                        placeholder="Override default"
                                        value={newSession.capacity}
                                        onChange={(e) => setNewSession({ ...newSession, capacity: e.target.value })}
                                    />
                                </div>
                            </div>
                            <Button
                                size="sm"
                                onClick={() => createSessionMutation.mutate()}
                                disabled={createSessionMutation.isPending || !newSession.startTime || !newSession.endTime}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                {createSessionMutation.isPending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Scheduling...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Session
                                    </>
                                )}
                            </Button>
                        </div>

                        <div className="space-y-4">
                            <h4 className="font-medium text-sm">Upcoming Sessions</h4>
                            <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                                {sessions?.map((session) => (
                                    <div key={session.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                        <div>
                                            <div className="font-medium">
                                                {new Date(session.startTime).toLocaleString()} - {new Date(session.endTime).toLocaleTimeString()}
                                            </div>
                                            <div className="text-sm text-slate-500 flex items-center gap-2">
                                                <Users className="h-3.5 w-3.5" />
                                                {session.bookedCount} / {session.capacity} booked
                                            </div>
                                        </div>
                                        <Badge
                                            variant={session.status === "open" ? "default" : "secondary"}
                                            className={session.status === "open" ? "bg-emerald-100 text-emerald-700" : ""}
                                        >
                                            {session.status}
                                        </Badge>
                                    </div>
                                ))}
                                {sessions?.length === 0 && (
                                    <div className="p-8 text-center text-slate-500">
                                        <Calendar className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                                        <p>No sessions scheduled yet.</p>
                                        <p className="text-sm">Add your first session above!</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Create Activity Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-emerald-600" />
                            Create New Activity
                        </DialogTitle>
                        <DialogDescription>
                            Add an exciting experience for your guests to enjoy.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-5 py-4">
                        {/* Image Upload */}
                        <div className="space-y-2">
                            <Label>Activity Image</Label>
                            <div
                                className={cn(
                                    "relative border-2 border-dashed rounded-lg transition-colors cursor-pointer",
                                    "hover:border-emerald-400 hover:bg-emerald-50/50",
                                    newActivity.imageUrl ? "border-emerald-300 bg-emerald-50" : "border-slate-200"
                                )}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {newActivity.imageUrl ? (
                                    <div className="relative aspect-video">
                                        <img
                                            src={newActivity.imageUrl}
                                            alt="Activity preview"
                                            className="w-full h-full object-cover rounded-lg"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                            <span className="text-white text-sm font-medium">Change Image</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-8 text-center">
                                        {uploading ? (
                                            <Loader2 className="h-8 w-8 mx-auto text-emerald-600 animate-spin" />
                                        ) : (
                                            <>
                                                <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                                                <p className="text-sm text-slate-600 font-medium">Click to upload an image</p>
                                                <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 5MB</p>
                                            </>
                                        )}
                                    </div>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleImageUpload(file);
                                    }}
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="activity-name">Activity Name</Label>
                            <Input
                                id="activity-name"
                                value={newActivity.name}
                                onChange={(e) => setNewActivity({ ...newActivity, name: e.target.value })}
                                placeholder="e.g. Morning Yoga by the Lake"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="activity-category">Category</Label>
                            <Select
                                value={newActivity.category}
                                onValueChange={(val) => setNewActivity({ ...newActivity, category: val })}
                            >
                                <SelectTrigger id="activity-category">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="recreation">Recreation</SelectItem>
                                    <SelectItem value="nature">Nature & Outdoors</SelectItem>
                                    <SelectItem value="water">Water Activities</SelectItem>
                                    <SelectItem value="food">Food & Dining</SelectItem>
                                    <SelectItem value="music">Entertainment</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="activity-description">Description</Label>
                            <Textarea
                                id="activity-description"
                                value={newActivity.description}
                                onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                                placeholder="What makes this activity special? What should guests expect?"
                                rows={3}
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="activity-price">Price ($)</Label>
                                <Input
                                    id="activity-price"
                                    type="number"
                                    value={newActivity.price}
                                    onChange={(e) => setNewActivity({ ...newActivity, price: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="activity-duration">Duration (mins)</Label>
                                <Input
                                    id="activity-duration"
                                    type="number"
                                    value={newActivity.duration}
                                    onChange={(e) => setNewActivity({ ...newActivity, duration: e.target.value })}
                                    placeholder="60"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="activity-capacity">Max Guests</Label>
                                <Input
                                    id="activity-capacity"
                                    type="number"
                                    value={newActivity.capacity}
                                    onChange={(e) => setNewActivity({ ...newActivity, capacity: e.target.value })}
                                    placeholder="20"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                        <Button
                            onClick={() => createMutation.mutate()}
                            disabled={createMutation.isPending || !newActivity.name}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            {createMutation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    Create Activity
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Event Dialog */}
            <CreateEventDialog
                open={isCreateEventOpen}
                onOpenChange={setIsCreateEventOpen}
                campgroundId={campgroundId}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["events", campgroundId] });
                }}
            />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-500/25">
                                <Star className="h-5 w-5" />
                            </span>
                            Activities & Events
                        </h1>
                        <p className="text-slate-500 mt-1">
                            Create memorable experiences for your guests
                        </p>
                    </div>
                    <Button
                        onClick={() => viewMode === "cards" ? setIsCreateOpen(true) : setIsCreateEventOpen(true)}
                        className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        {viewMode === "cards" ? "New Activity" : "Add Event"}
                    </Button>
                </div>

                {/* View Toggle - Proper Tab Pattern */}
                <div
                    role="tablist"
                    aria-label="View options"
                    className="inline-flex p-1 bg-slate-100 rounded-lg"
                >
                    <button
                        role="tab"
                        id="tab-cards"
                        aria-selected={viewMode === "cards"}
                        aria-controls="panel-cards"
                        onClick={() => setViewMode("cards")}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
                            viewMode === "cards"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-600 hover:text-slate-900"
                        )}
                    >
                        <LayoutGrid className="h-4 w-4" />
                        Activities
                    </button>
                    <button
                        role="tab"
                        id="tab-calendar"
                        aria-selected={viewMode === "calendar"}
                        aria-controls="panel-calendar"
                        onClick={() => setViewMode("calendar")}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
                            viewMode === "calendar"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-600 hover:text-slate-900"
                        )}
                    >
                        <Calendar className="h-4 w-4" />
                        Calendar
                    </button>
                </div>

                {/* Live region for announcements */}
                <div role="status" aria-live="polite" className="sr-only">
                    {isLoading ? "Loading activities..." : `${activities?.length || 0} activities loaded`}
                </div>

                {/* Cards View */}
                <div
                    role="tabpanel"
                    id="panel-cards"
                    aria-labelledby="tab-cards"
                    hidden={viewMode !== "cards"}
                >
                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <ActivityCardSkeleton key={i} />
                            ))}
                        </div>
                    ) : activities?.length === 0 ? (
                        <EmptyActivitiesState onCreateClick={() => setIsCreateOpen(true)} />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {activities?.map((activity, index) => (
                                <div
                                    key={activity.id}
                                    className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4"
                                    style={{ animationDelay: `${index * 50}ms`, animationFillMode: "backwards" }}
                                >
                                    <ActivityCard
                                        activity={activity}
                                        onManageSessions={setSelectedActivityForSessions}
                                        onDelete={handleDelete}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Calendar View */}
                <div
                    role="tabpanel"
                    id="panel-calendar"
                    aria-labelledby="tab-calendar"
                    hidden={viewMode !== "calendar"}
                >
                    <Card className="overflow-hidden">
                        <CardContent className="p-6" style={{ height: "650px" }}>
                            {eventsLoading ? (
                                <div className="flex h-full items-center justify-center">
                                    <div className="text-center">
                                        <Loader2 className="h-10 w-10 animate-spin text-emerald-500 mx-auto mb-3" />
                                        <p className="text-slate-500">Loading events...</p>
                                    </div>
                                </div>
                            ) : (
                                <BigCalendar
                                    localizer={localizer}
                                    events={calendarEvents}
                                    startAccessor="start"
                                    endAccessor="end"
                                    style={{ height: "100%" }}
                                    views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
                                    defaultView={Views.MONTH}
                                    onSelectEvent={handleSelectEvent}
                                    eventPropGetter={() => ({
                                        style: {
                                            backgroundColor: "#10b981",
                                            borderRadius: "6px",
                                            border: "none",
                                            padding: "2px 6px"
                                        }
                                    })}
                                />
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardShell>
    );
}
