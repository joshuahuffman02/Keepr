"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { format, isBefore, isAfter, isToday, parseISO } from "date-fns";
import { CalendarOff, Plus, Trash2, AlertCircle, Calendar, MapPin } from "lucide-react";

interface BlackoutDate {
    id: string;
    campgroundId: string;
    siteId?: string | null;
    startDate: string;
    endDate: string;
    reason?: string | null;
    site?: { id: string; siteNumber: string; name: string } | null;
}

interface Site {
    id: string;
    siteNumber: string;
    name: string;
}

export default function BlackoutDatesPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [campgroundId, setCampgroundId] = useState<string>("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draftBlackout, setDraftBlackout] = useState({
        startDate: "",
        endDate: "",
        reason: "",
        siteId: ""
    });

    // Get campground ID from localStorage
    useEffect(() => {
        if (typeof window === "undefined") return;
        const stored = localStorage.getItem("campreserv:selectedCampground");
        if (stored) setCampgroundId(stored);
    }, []);

    // Fetch blackout dates
    const { data: blackouts = [], isLoading } = useQuery({
        queryKey: ["blackouts", campgroundId],
        queryFn: () => apiClient.getBlackouts(campgroundId),
        enabled: !!campgroundId
    });

    // Fetch sites for dropdown
    const { data: sites = [] } = useQuery({
        queryKey: ["sites", campgroundId],
        queryFn: () => apiClient.getSites(campgroundId),
        enabled: !!campgroundId
    });

    // Create mutation
    const createMutation = useMutation({
        mutationFn: (data: { campgroundId: string; startDate: string; endDate: string; reason: string; siteId?: string }) =>
            apiClient.createBlackout(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["blackouts", campgroundId] });
            toast({ title: "Success", description: "Blackout date created successfully." });
            closeDialog();
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const updateMutation = useMutation({
        mutationFn: (data: { id: string; payload: { startDate: string; endDate: string; reason: string; siteId?: string } }) =>
            apiClient.updateBlackout(data.id, data.payload, campgroundId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["blackouts", campgroundId] });
            toast({ title: "Success", description: "Blackout date updated." });
            closeDialog();
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiClient.deleteBlackout(id, campgroundId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["blackouts", campgroundId] });
            toast({ title: "Success", description: "Blackout date deleted." });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    const handleSubmit = () => {
        if (!draftBlackout.startDate || !draftBlackout.endDate || !draftBlackout.reason) {
            toast({ title: "Error", description: "Please fill all required fields.", variant: "destructive" });
            return;
        }
        const payload = {
            campgroundId,
            startDate: draftBlackout.startDate,
            endDate: draftBlackout.endDate,
            reason: draftBlackout.reason,
            siteId: draftBlackout.siteId || undefined
        };

        if (dialogMode === "create") {
            createMutation.mutate(payload);
        } else if (editingId) {
            updateMutation.mutate({ id: editingId, payload });
        }
    };

    const openCreateDialog = () => {
        setDialogMode("create");
        setEditingId(null);
        setDraftBlackout({ startDate: "", endDate: "", reason: "", siteId: "" });
        setIsDialogOpen(true);
    };

    const openEditDialog = (blackout: BlackoutDate) => {
        setDialogMode("edit");
        setEditingId(blackout.id);
        setDraftBlackout({
            startDate: blackout.startDate.slice(0, 10),
            endDate: blackout.endDate.slice(0, 10),
            reason: blackout.reason || "",
            siteId: blackout.siteId || ""
        });
        setIsDialogOpen(true);
    };

    const closeDialog = () => {
        setIsDialogOpen(false);
        setEditingId(null);
        setDraftBlackout({ startDate: "", endDate: "", reason: "", siteId: "" });
    };

    const getBlackoutStatus = (blackout: BlackoutDate) => {
        const start = parseISO(blackout.startDate);
        const end = parseISO(blackout.endDate);
        const now = new Date();

        if (isBefore(end, now)) return "past";
        if (isAfter(start, now)) return "upcoming";
        return "active";
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "active":
                return <Badge className="bg-rose-100 text-rose-800 border-rose-200">Active</Badge>;
            case "upcoming":
                return <Badge className="bg-status-warning/15 text-status-warning border-status-warning/30">Upcoming</Badge>;
            case "past":
                return <Badge variant="secondary">Past</Badge>;
            default:
                return null;
        }
    };

    // Separate into active/upcoming and past
    const activeBlackouts = blackouts.filter((b) => getBlackoutStatus(b) !== "past");
    const pastBlackouts = blackouts.filter((b) => getBlackoutStatus(b) === "past");

    if (isLoading) {
        return (
            <div>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Blackout Dates</h1>
                        <p className="text-muted-foreground">
                            Block dates for maintenance, private events, or closures
                        </p>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setIsDialogOpen(true); }}>
                        <DialogTrigger asChild>
                            <Button onClick={openCreateDialog}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Blackout
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>{dialogMode === "create" ? "Create Blackout Date" : "Edit Blackout Date"}</DialogTitle>
                                <DialogDescription>
                                    Block dates to prevent bookings. Leave site empty for park-wide blackout.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="startDate">Start Date</Label>
                                    <Input
                                        id="startDate"
                                        type="date"
                                    value={draftBlackout.startDate}
                                    onChange={(e) => setDraftBlackout({ ...draftBlackout, startDate: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="endDate">End Date</Label>
                                    <Input
                                        id="endDate"
                                        type="date"
                                    value={draftBlackout.endDate}
                                    onChange={(e) => setDraftBlackout({ ...draftBlackout, endDate: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="site">Site (optional)</Label>
                                    <Select
                                    value={draftBlackout.siteId || "all"}
                                    onValueChange={(val) => setDraftBlackout({ ...draftBlackout, siteId: val === "all" ? "" : val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="All sites (park-wide)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All sites (park-wide)</SelectItem>
                                            {sites.map((site: Site) => (
                                                <SelectItem key={site.id} value={site.id}>
                                                    {site.siteNumber} - {site.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="reason">Reason</Label>
                                    <Textarea
                                        id="reason"
                                        placeholder="e.g., Annual maintenance, Private event, Weather closure..."
                                        value={draftBlackout.reason}
                                        onChange={(e) => setDraftBlackout({ ...draftBlackout, reason: e.target.value })}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={closeDialog}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                >
                                    {createMutation.isPending || updateMutation.isPending
                                        ? "Saving..."
                                        : dialogMode === "create"
                                            ? "Create Blackout"
                                            : "Save Changes"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Active/Upcoming Blackouts */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CalendarOff className="h-5 w-5 text-rose-500" />
                            Active & Upcoming Blackouts
                        </CardTitle>
                        <CardDescription>
                            Dates currently blocking or scheduled to block reservations
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {activeBlackouts.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <CalendarOff className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p>No active or upcoming blackout dates</p>
                                <p className="text-sm mt-1">Create one to block dates for maintenance or events</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {activeBlackouts.map((blackout) => (
                                    <div
                                        key={blackout.id}
                                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="p-2 rounded-lg bg-rose-50">
                                                <Calendar className="h-5 w-5 text-rose-600" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">
                                                        {format(parseISO(blackout.startDate), "MMM d, yyyy")} —{" "}
                                                        {format(parseISO(blackout.endDate), "MMM d, yyyy")}
                                                    </span>
                                                    {getStatusBadge(getBlackoutStatus(blackout))}
                                                </div>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {blackout.reason}
                                                </p>
                                                {blackout.site ? (
                                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                                                        <MapPin className="h-3 w-3" />
                                                        Site {blackout.site.siteNumber}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1 text-xs text-amber-600 mt-2">
                                                        <AlertCircle className="h-3 w-3" />
                                                        Park-wide blackout
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                onClick={() => openEditDialog(blackout)}
                                            >
                                                Edit
                                            </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                            onClick={() => deleteMutation.mutate(blackout.id)}
                                            disabled={deleteMutation.isPending}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Past Blackouts */}
                {pastBlackouts.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-muted-foreground">Past Blackouts</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {pastBlackouts.slice(0, 10).map((blackout) => (
                                    <div
                                        key={blackout.id}
                                        className="flex items-center justify-between p-3 border rounded-lg opacity-60"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm">
                                                {format(parseISO(blackout.startDate), "MMM d")} —{" "}
                                                {format(parseISO(blackout.endDate), "MMM d, yyyy")}
                                            </span>
                                            <span className="text-sm text-muted-foreground">
                                                {blackout.reason}
                                            </span>
                                            {blackout.site && (
                                                <Badge variant="outline" className="text-xs">
                                                    Site {blackout.site.siteNumber}
                                                </Badge>
                                            )}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-muted-foreground"
                                            onClick={() => deleteMutation.mutate(blackout.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
