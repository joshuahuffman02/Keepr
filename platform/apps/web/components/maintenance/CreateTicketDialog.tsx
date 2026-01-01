"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";
import type { Site } from "@campreserv/shared";

type MaintenancePriority = "low" | "medium" | "high" | "critical";
type MaintenanceStatus = "open" | "in_progress" | "closed";

export interface MaintenanceTicket {
    id: string;
    title: string;
    description?: string;
    priority: MaintenancePriority;
    status: MaintenanceStatus;
    siteId?: string;
    isBlocking?: boolean;
    outOfOrder?: boolean;
    outOfOrderReason?: string;
    dueDate?: string;
    campgroundId: string;
}

interface CreateTicketDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    campgroundId?: string | null;
    ticket?: MaintenanceTicket | null; // If provided, edit mode
}

type SiteOption = Pick<Site, "id" | "name" | "siteNumber">;

export function CreateTicketDialog({ open, onOpenChange, onSuccess, campgroundId, ticket }: CreateTicketDialogProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [sites, setSites] = useState<SiteOption[]>([]);
    const [sitesLoading, setSitesLoading] = useState(false);
    const [selectedCampgroundId, setSelectedCampgroundId] = useState<string | null>(campgroundId ?? null);

    const isEditMode = !!ticket;

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        priority: "medium" as MaintenancePriority,
        status: "open" as MaintenanceStatus,
        siteId: "none",
        isBlocking: false,
        outOfOrder: false,
        outOfOrderReason: "",
        dueDate: ""
    });

    useEffect(() => {
        if (open) {
            const stored = localStorage.getItem("campreserv:selectedCampground");
            const nextCampgroundId = ticket?.campgroundId ?? campgroundId ?? stored ?? null;
            setSelectedCampgroundId(nextCampgroundId);
            void loadSites(nextCampgroundId);

            // Populate form if editing
            if (ticket) {
                setFormData({
                    title: ticket.title,
                    description: ticket.description || "",
                    priority: ticket.priority,
                    status: ticket.status,
                    siteId: ticket.siteId || "none",
                    isBlocking: ticket.isBlocking || false,
                    outOfOrder: ticket.outOfOrder || false,
                    outOfOrderReason: ticket.outOfOrderReason || "",
                    dueDate: ticket.dueDate ? ticket.dueDate.split("T")[0] : ""
                });
            } else {
                // Reset form for create mode
                setFormData({
                    title: "",
                    description: "",
                    priority: "medium",
                    status: "open",
                    siteId: "none",
                    isBlocking: false,
                    outOfOrder: false,
                    outOfOrderReason: "",
                    dueDate: ""
                });
            }
        }
    }, [open, campgroundId, ticket]);

    async function loadSites(nextCampgroundId: string | null) {
        if (!nextCampgroundId) {
            setSites([]);
            return;
        }
        try {
            setSitesLoading(true);
            const data = await apiClient.getSites(nextCampgroundId);
            const activeSites = data.filter((site) => site.isActive ?? true);
            setSites(activeSites.map((site) => ({
                id: site.id,
                name: site.name,
                siteNumber: site.siteNumber
            })));
        } catch (e) {
            console.error(e);
            setSites([]);
        } finally {
            setSitesLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            if (!selectedCampgroundId) {
                toast({
                    title: "Select a campground",
                    description: "Pick a campground before saving the ticket.",
                    variant: "destructive"
                });
                setLoading(false);
                return;
            }

            const payload = {
                title: formData.title,
                description: formData.description,
                priority: formData.priority,
                status: formData.status as "open" | "in_progress" | "closed",
                siteId: formData.siteId === "none" ? undefined : formData.siteId,
                campgroundId: selectedCampgroundId,
                isBlocking: formData.isBlocking,
                outOfOrder: formData.outOfOrder,
                outOfOrderReason: formData.outOfOrder ? formData.outOfOrderReason : undefined,
                dueDate: formData.dueDate || undefined,
            };

            if (isEditMode && ticket) {
                await apiClient.updateMaintenance(ticket.id, payload);
                toast({
                    title: "Ticket updated",
                    description: "Maintenance ticket has been updated successfully."
                });
            } else {
                await apiClient.createMaintenanceTicket(payload);
                toast({
                    title: "Ticket created",
                    description: "Maintenance ticket has been created successfully."
                });
            }

            setFormData({
                title: "",
                description: "",
                priority: "medium",
                status: "open",
                siteId: "none",
                isBlocking: false,
                outOfOrder: false,
                outOfOrderReason: "",
                dueDate: ""
            });

            onSuccess();
        } catch (error) {
            toast({
                title: "Error",
                description: isEditMode ? "Failed to update ticket. Please try again." : "Failed to create ticket. Please try again.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{isEditMode ? "Edit Maintenance Ticket" : "Create Maintenance Ticket"}</DialogTitle>
                    <DialogDescription>
                        {isEditMode ? "Update ticket details and status." : "Report an issue or schedule maintenance."}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Title</Label>
                        <Input
                            id="title"
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="e.g., Leaking faucet at Site 12"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Details about the issue..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="priority">Priority</Label>
                            <Select
                                value={formData.priority}
                                onValueChange={(v) => setFormData({ ...formData, priority: v as MaintenancePriority })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="critical">Critical</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="site">Site (Optional)</Label>
                            <Select
                                value={formData.siteId}
                                onValueChange={(v) => setFormData({ ...formData, siteId: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={sitesLoading ? "Loading sites..." : "Select site"} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None / General</SelectItem>
                                    {sites.length === 0 && !sitesLoading ? (
                                        <SelectItem value="__empty" disabled>
                                            No sites available
                                        </SelectItem>
                                    ) : (
                                        sites.map((site) => (
                                            <SelectItem key={site.id} value={site.id}>
                                                {site.siteNumber} · {site.name}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {isEditMode && (
                        <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select
                                value={formData.status}
                                onValueChange={(v) => setFormData({ ...formData, status: v as MaintenanceStatus })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="open">Open</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="closed">Closed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="flex items-center justify-between space-x-2 border p-3 rounded-md">
                        <div className="space-y-0.5">
                            <Label className="text-base">Block Availability</Label>
                            <p className="text-sm text-muted-foreground">
                                Prevent bookings for this site while ticket is open
                            </p>
                        </div>
                        <Switch
                            checked={formData.isBlocking}
                            onCheckedChange={(c) => setFormData({ ...formData, isBlocking: c })}
                        />
                    </div>

                    <div className="flex items-center justify-between space-x-2 border p-3 rounded-md border-amber-200 bg-amber-50">
                        <div className="space-y-0.5">
                            <Label className="text-base text-amber-900">Site Out of Order</Label>
                            <p className="text-sm text-amber-700">
                                Mark site as unavailable until maintenance is complete
                            </p>
                        </div>
                        <Switch
                            checked={formData.outOfOrder}
                            onCheckedChange={(c) => setFormData({ ...formData, outOfOrder: c })}
                        />
                    </div>

                    {formData.outOfOrder && (
                        <div className="space-y-2">
                            <Label htmlFor="outOfOrderReason">Out of Order Reason</Label>
                            <Input
                                id="outOfOrderReason"
                                value={formData.outOfOrderReason}
                                onChange={(e) => setFormData({ ...formData, outOfOrderReason: e.target.value })}
                                placeholder="e.g., Electrical hazard, plumbing issue..."
                            />
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Saving..." : isEditMode ? "Save Changes" : "Create Ticket"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
