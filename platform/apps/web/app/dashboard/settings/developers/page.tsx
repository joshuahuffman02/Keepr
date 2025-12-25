"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus, RefreshCw, Trash2, Code } from "lucide-react";
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
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

export default function DevelopersSettingsPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [campgroundId, setCampgroundId] = useState<string | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newClientName, setNewClientName] = useState("");
    const [createdClientSecret, setCreatedClientSecret] = useState<string | null>(null);
    const [createdClientId, setCreatedClientId] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const stored = localStorage.getItem("campreserv:selectedCampground");
        if (stored) setCampgroundId(stored);
    }, []);

    const { data: clients, isLoading } = useQuery({
        queryKey: ["api-clients", campgroundId],
        queryFn: () => apiClient.listApiClients(campgroundId!),
        enabled: !!campgroundId,
    });

    const createMutation = useMutation({
        mutationFn: async (name: string) => {
            return apiClient.createApiClient(campgroundId!, name);
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["api-clients"] });
            setCreatedClientSecret(data.clientSecret);
            setCreatedClientId(data.client.clientId);
            toast({ title: "API Client created", description: "Make sure to copy the secret now!" });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to create API client", variant: "destructive" });
        }
    });

    const rotateMutation = useMutation({
        mutationFn: async (clientId: string) => {
            return apiClient.rotateApiClientSecret(clientId);
        },
        onSuccess: (data) => {
            setCreatedClientSecret(data.clientSecret);
            setCreatedClientId(data.client.clientId);
            setIsCreateOpen(true); // Re-use the dialog to show the new secret
            toast({ title: "Secret rotated", description: "Previous secret is now invalid." });
        }
    });

    const toggleMutation = useMutation({
        mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
            return apiClient.toggleApiClient(id, isActive);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["api-clients"] });
            toast({ title: "Client updated" });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            return apiClient.deleteApiClient(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["api-clients"] });
            toast({ title: "Client deleted" });
        }
    });

    const handleCreate = () => {
        if (!newClientName.trim()) return;
        createMutation.mutate(newClientName);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "Copied to clipboard" });
    };

    const resetCreateDialog = () => {
        setIsCreateOpen(false);
        setNewClientName("");
        setCreatedClientSecret(null);
        setCreatedClientId(null);
    };

    return (
        <div>
            <div className="space-y-6">
                <Breadcrumbs items={[{ label: "Settings" }, { label: "Developers & API" }]} />

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Developers & API</h1>
                        <p className="text-muted-foreground">
                            Manage API keys and access tokens for external integrations.
                        </p>
                    </div>

                    <Dialog open={isCreateOpen} onOpenChange={(open) => !open && resetCreateDialog()}>
                        <DialogTrigger asChild>
                            <Button onClick={() => setIsCreateOpen(true)} disabled={!campgroundId}>
                                <Plus className="mr-2 h-4 w-4" />
                                Create API Key
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{createdClientSecret ? "API Key Created" : "Create API Key"}</DialogTitle>
                                <DialogDescription>
                                    {createdClientSecret
                                        ? "This is the only time the client secret will be shown. Copy it now."
                                        : "Create a new client ID and secret pair for accessing the API."}
                                </DialogDescription>
                            </DialogHeader>

                            {createdClientSecret ? (
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Client ID</Label>
                                        <div className="flex items-center gap-2">
                                            <code className="flex-1 rounded bg-slate-100 p-2 font-mono text-sm dark:bg-slate-800">
                                                {createdClientId}
                                            </code>
                                            <Button size="icon" variant="ghost" onClick={() => copyToClipboard(createdClientId!)}>
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Client Secret</Label>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 rounded bg-yellow-50 p-2 font-mono text-sm text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-100 break-all">
                                                {createdClientSecret}
                                            </div>
                                            <Button size="icon" variant="ghost" onClick={() => copyToClipboard(createdClientSecret!)}>
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            Store this securely. It will not be shown again.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>App / Client Name</Label>
                                        <Input
                                            placeholder="e.g. Website Integration"
                                            value={newClientName}
                                            onChange={(e) => setNewClientName(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}

                            <DialogFooter>
                                {createdClientSecret ? (
                                    <Button onClick={resetCreateDialog}>Done</Button>
                                ) : (
                                    <Button onClick={handleCreate} disabled={createMutation.isPending || !newClientName}>
                                        {createMutation.isPending ? "Creating..." : "Create"}
                                    </Button>
                                )}
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="rounded-md border bg-white dark:bg-slate-950">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Client ID</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                        Loading...
                                    </TableCell>
                                </TableRow>
                            ) : clients?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                        No API keys found. Create one to get started.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                clients?.map((client) => (
                                    <TableRow key={client.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <Code className="h-4 w-4 text-slate-400" />
                                                {client.name}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">{client.clientId}</TableCell>
                                        <TableCell className="text-slate-500">
                                            {format(new Date(client.createdAt), "MMM d, yyyy")}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={client.isActive}
                                                    onCheckedChange={(checked) => toggleMutation.mutate({ id: client.id, isActive: checked })}
                                                />
                                                <span className="text-xs text-slate-500">{client.isActive ? "Active" : "Inactive"}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        if (confirm("Rotate client secret? The old secret will stop working immediately.")) {
                                                            rotateMutation.mutate(client.id);
                                                        }
                                                    }}
                                                    title="Rotate Secret"
                                                >
                                                    <RefreshCw className="h-4 w-4 text-slate-500" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        if (confirm("Delete this API key permanently?")) {
                                                            deleteMutation.mutate(client.id);
                                                        }
                                                    }}
                                                    title="Delete"
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
