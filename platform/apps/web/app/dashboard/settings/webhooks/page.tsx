"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus, RefreshCw, Activity, Terminal, Play } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const WEBHOOK_EVENTS = [
    "reservation.created",
    "reservation.updated",
    "reservation.deleted",
    "payment.created",
    "guest.created"
];

export default function WebhooksSettingsPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [campgroundId, setCampgroundId] = useState<string | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Create Form State
    const [newUrl, setNewUrl] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
    const [createdSecret, setCreatedSecret] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const stored = localStorage.getItem("campreserv:selectedCampground");
        if (stored) setCampgroundId(stored);
    }, []);

    const { data: endpoints, isLoading: isLoadingEndpoints } = useQuery({
        queryKey: ["webhooks", campgroundId],
        queryFn: () => apiClient.listWebhooks(campgroundId!),
        enabled: !!campgroundId,
    });

    const { data: deliveries, isLoading: isLoadingDeliveries } = useQuery({
        queryKey: ["webhook-deliveries", campgroundId],
        queryFn: () => apiClient.listWebhookDeliveries(campgroundId!),
        enabled: !!campgroundId,
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            return apiClient.createWebhook(campgroundId!, {
                url: newUrl,
                description: newDesc,
                eventTypes: selectedEvents.length ? selectedEvents : ["*"]
            });
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["webhooks"] });
            setCreatedSecret(data.secret);
            toast({ title: "Webhook created", description: "Copy the secret now!" });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to create webhook", variant: "destructive" });
        }
    });

    const toggleMutation = useMutation({
        mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
            return apiClient.toggleWebhook(id, isActive);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["webhooks"] });
            toast({ title: "Webhook updated" });
        }
    });

    const replayMutation = useMutation({
        mutationFn: async (id: string) => {
            return apiClient.replayWebhookDelivery(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["webhook-deliveries"] });
            toast({ title: "Delivery replayed" });
        }
    });

    const handleCreate = () => {
        if (!newUrl.trim()) return;
        createMutation.mutate();
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "Copied to clipboard" });
    };

    const resetCreateDialog = () => {
        setIsCreateOpen(false);
        setNewUrl("");
        setNewDesc("");
        setSelectedEvents([]);
        setCreatedSecret(null);
    };

    return (
        <div>
            <div className="space-y-6">
                <Breadcrumbs items={[{ label: "Settings" }, { label: "Webhooks" }]} />

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Webhooks</h1>
                        <p className="text-muted-foreground">
                            Subscribe to events and receive real-time notifications.
                        </p>
                    </div>

                    <Dialog open={isCreateOpen} onOpenChange={(open) => !open && resetCreateDialog()}>
                        <DialogTrigger asChild>
                            <Button onClick={() => setIsCreateOpen(true)} disabled={!campgroundId}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Endpoint
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>{createdSecret ? "Webhook Created" : "Add Webhook Endpoint"}</DialogTitle>
                                <DialogDescription>
                                    {createdSecret
                                        ? "Copy your webhook signing secret now. It will not be shown again."
                                        : "Enter the URL where you want to receive events."}
                                </DialogDescription>
                            </DialogHeader>

                            {createdSecret ? (
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Signing Secret</Label>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 rounded bg-yellow-50 p-2 font-mono text-sm text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-100 break-all">
                                                {createdSecret}
                                            </div>
                                            <Button size="icon" variant="ghost" onClick={() => copyToClipboard(createdSecret!)}>
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Endpoint URL</Label>
                                        <Input
                                            placeholder="https://api.myapp.com/webhooks/campreserv"
                                            value={newUrl}
                                            onChange={(e) => setNewUrl(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Description</Label>
                                        <Input
                                            placeholder="Production Environment"
                                            value={newDesc}
                                            onChange={(e) => setNewDesc(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Events</Label>
                                        <div className="grid grid-cols-2 gap-2 border rounded p-3">
                                            {WEBHOOK_EVENTS.map(evt => (
                                                <div key={evt} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={evt}
                                                        checked={selectedEvents.includes(evt)}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) setSelectedEvents([...selectedEvents, evt]);
                                                            else setSelectedEvents(selectedEvents.filter(e => e !== evt));
                                                        }}
                                                    />
                                                    <label htmlFor={evt} className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                                        {evt}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs text-muted-foreground">Values: {selectedEvents.length ? selectedEvents.join(", ") : "All events (*)"}</p>
                                    </div>
                                </div>
                            )}

                            <DialogFooter>
                                {createdSecret ? (
                                    <Button onClick={resetCreateDialog}>Done</Button>
                                ) : (
                                    <Button onClick={handleCreate} disabled={createMutation.isPending || !newUrl}>
                                        {createMutation.isPending ? "Creating..." : "Create Webhook"}
                                    </Button>
                                )}
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <Tabs defaultValue="endpoints">
                    <TabsList>
                        <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
                        <TabsTrigger value="deliveries">Delivery Logs</TabsTrigger>
                    </TabsList>

                    <TabsContent value="endpoints" className="space-y-4">
                        <div className="rounded-md border bg-white dark:bg-slate-950">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>URL / Description</TableHead>
                                        <TableHead>Events</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Created</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoadingEndpoints ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                                                Loading...
                                            </TableCell>
                                        </TableRow>
                                    ) : endpoints?.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                                                No webhooks configured.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        endpoints?.map((webhook) => (
                                            <TableRow key={webhook.id}>
                                                <TableCell>
                                                    <div className="font-medium text-sm gap-1 flex flex-col">
                                                        <span className="font-mono text-xs text-slate-600">{webhook.url}</span>
                                                        {webhook.description && <span className="text-slate-500">{webhook.description}</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {webhook.eventTypes.map((et: string) => (
                                                            <span key={et} className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                                                                {et}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Switch
                                                            checked={webhook.isActive}
                                                            onCheckedChange={(checked) => toggleMutation.mutate({ id: webhook.id, isActive: checked })}
                                                        />
                                                        <span className="text-xs text-slate-500">{webhook.isActive ? "Active" : "Inactive"}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-slate-500">
                                                    {format(new Date(webhook.createdAt), "MMM d, yyyy")}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>

                    <TabsContent value="deliveries" className="space-y-4">
                        <div className="rounded-md border bg-white dark:bg-slate-950">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Event</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Endpoint</TableHead>
                                        <TableHead>Time</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoadingDeliveries ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                                Loading...
                                            </TableCell>
                                        </TableRow>
                                    ) : deliveries?.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                                No events delivered yet.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        deliveries?.map((delivery) => (
                                            <TableRow key={delivery.id}>
                                                <TableCell>
                                                    <div className="font-medium text-sm">{delivery.eventType}</div>
                                                    <div className="text-xs text-slate-500 font-mono truncate max-w-[200px]">
                                                        ID: {delivery.id}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent ${delivery.status === 'delivered' ? 'bg-green-100 text-green-800' :
                                                            delivery.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                                'bg-red-100 text-red-800'
                                                        }`}>
                                                        {delivery.status}
                                                        {delivery.responseStatus && ` (${delivery.responseStatus})`}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-[200px] truncate text-xs text-slate-500" title={delivery.webhookEndpoint?.url}>
                                                    {delivery.webhookEndpoint?.url}
                                                </TableCell>
                                                <TableCell className="text-slate-500 text-xs">
                                                    {format(new Date(delivery.createdAt), "MMM d, HH:mm:ss")}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => replayMutation.mutate(delivery.id)}
                                                        title="Replay Event"
                                                    >
                                                        <Play className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
