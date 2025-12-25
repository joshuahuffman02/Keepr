"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus,
  RefreshCw,
  Settings,
  Link2,
  Unlink,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

const POS_PROVIDERS = [
  {
    id: "lightspeed",
    name: "Lightspeed R-Series",
    description: "Connect to Lightspeed Retail POS for inventory and sales sync",
    fields: [
      { key: "accountId", label: "Account ID", type: "text", required: true },
      { key: "accessToken", label: "Access Token", type: "password", required: true },
    ],
  },
  {
    id: "shopify",
    name: "Shopify POS",
    description: "Sync products and inventory with Shopify POS",
    fields: [
      { key: "shopDomain", label: "Shop Domain", type: "text", placeholder: "mystore.myshopify.com", required: true },
      { key: "accessToken", label: "Access Token", type: "password", required: true },
      { key: "locationId", label: "Default Location ID", type: "text", required: false },
    ],
  },
  {
    id: "vend",
    name: "Vend (Lightspeed X-Series)",
    description: "Connect to Vend for product and inventory management",
    fields: [
      { key: "domainPrefix", label: "Domain Prefix", type: "text", placeholder: "yourstore", required: true },
      { key: "accessToken", label: "Access Token", type: "password", required: true },
      { key: "defaultOutletId", label: "Default Outlet ID", type: "text", required: false },
    ],
  },
];

type Integration = Awaited<ReturnType<typeof apiClient.listPosIntegrations>>[0];

export default function PosIntegrationsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [campgroundId, setCampgroundId] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("campreserv:selectedCampground") : null;
    if (stored) setCampgroundId(stored);
  }, []);

  const integrationsQuery = useQuery({
    queryKey: ["pos-integrations", campgroundId],
    queryFn: () => apiClient.listPosIntegrations(campgroundId),
    enabled: !!campgroundId,
  });

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof apiClient.createPosIntegration>[0]) =>
      apiClient.createPosIntegration(payload),
    onSuccess: () => {
      toast({ title: "POS connection created" });
      qc.invalidateQueries({ queryKey: ["pos-integrations", campgroundId] });
      resetDialog();
    },
    onError: (err: any) => {
      toast({ title: "Failed to create connection", description: err?.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => apiClient.testPosConnection(id),
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Connection successful", description: data.message });
      } else {
        toast({ title: "Connection failed", description: data.message, variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Test failed", description: err?.message, variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: ({ id, type }: { id: string; type: "products" | "inventory" | "sales" }) =>
      apiClient.triggerPosSync(id, type),
    onSuccess: (data) => {
      toast({ title: "Sync started", description: data.message });
      qc.invalidateQueries({ queryKey: ["pos-integrations", campgroundId] });
    },
    onError: (err: any) => {
      toast({ title: "Sync failed", description: err?.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deletePosIntegration(id),
    onSuccess: () => {
      toast({ title: "Connection removed" });
      qc.invalidateQueries({ queryKey: ["pos-integrations", campgroundId] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to remove", description: err?.message, variant: "destructive" });
    },
  });

  const resetDialog = () => {
    setIsCreateOpen(false);
    setSelectedProvider(null);
    setCredentials({});
    setDisplayName("");
  };

  const handleCreate = () => {
    if (!selectedProvider) return;
    const provider = POS_PROVIDERS.find((p) => p.id === selectedProvider);
    if (!provider) return;

    // Validate required fields
    const missingFields = provider.fields
      .filter((f) => f.required && !credentials[f.key])
      .map((f) => f.label);

    if (missingFields.length > 0) {
      toast({
        title: "Missing required fields",
        description: missingFields.join(", "),
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      campgroundId,
      provider: selectedProvider,
      displayName: displayName || provider.name,
      credentials,
      capabilities: ["inventory_push", "inventory_pull"],
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-100 text-emerald-800">Connected</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-5 w-5 text-emerald-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "pending":
        return <Clock className="h-5 w-5 text-amber-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-slate-400" />;
    }
  };

  const providerInfo = (providerId: string) => POS_PROVIDERS.find((p) => p.id === providerId);

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">POS Integrations</h1>
            <p className="text-slate-600">
              Connect external POS systems to sync inventory, products, and sales.
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={(open) => !open && resetDialog()}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add POS Connection
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Connect POS System</DialogTitle>
                <DialogDescription>
                  Select a POS provider and enter your credentials to connect.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Provider Selection */}
                <div className="space-y-2">
                  <Label>POS Provider</Label>
                  <Select value={selectedProvider ?? ""} onValueChange={setSelectedProvider}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a provider..." />
                    </SelectTrigger>
                    <SelectContent>
                      {POS_PROVIDERS.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {provider.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedProvider && (
                    <p className="text-sm text-slate-500">
                      {providerInfo(selectedProvider)?.description}
                    </p>
                  )}
                </div>

                {/* Provider-specific fields */}
                {selectedProvider && (
                  <>
                    <div className="space-y-2">
                      <Label>Display Name (optional)</Label>
                      <Input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder={providerInfo(selectedProvider)?.name}
                      />
                    </div>

                    {providerInfo(selectedProvider)?.fields.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <Label>
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <Input
                          type={field.type}
                          placeholder={field.placeholder}
                          value={credentials[field.key] || ""}
                          onChange={(e) =>
                            setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))
                          }
                        />
                      </div>
                    ))}
                  </>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={resetDialog}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!selectedProvider || createMutation.isPending}
                >
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Connect
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="connections">
          <TabsList>
            <TabsTrigger value="connections">Connections</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="logs">Sync Logs</TabsTrigger>
          </TabsList>

          {/* Connections Tab */}
          <TabsContent value="connections" className="space-y-4">
            {integrationsQuery.isLoading ? (
              <Card>
                <CardContent className="py-8 text-center text-slate-500">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading integrations...
                </CardContent>
              </Card>
            ) : integrationsQuery.data?.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="text-slate-400 mb-4">
                    <Link2 className="h-12 w-12 mx-auto" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No POS Connections</h3>
                  <p className="text-slate-600 mb-4">
                    Connect an external POS system to sync inventory and sales.
                  </p>
                  <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Connection
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {integrationsQuery.data?.map((integration) => (
                  <Card key={integration.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="mt-1">{getStatusIcon(integration.status)}</div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-slate-900">
                                {integration.displayName ||
                                  providerInfo(integration.provider)?.name ||
                                  integration.provider}
                              </h3>
                              {getStatusBadge(integration.status)}
                            </div>
                            <p className="text-sm text-slate-500 mt-1">
                              {providerInfo(integration.provider)?.description}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                              {integration.lastSyncAt && (
                                <span>
                                  Last sync:{" "}
                                  {formatDistanceToNow(new Date(integration.lastSyncAt), {
                                    addSuffix: true,
                                  })}
                                </span>
                              )}
                              {integration.mappingCount !== undefined && (
                                <span>{integration.mappingCount} products mapped</span>
                              )}
                            </div>
                            {integration.lastError && (
                              <p className="text-sm text-red-600 mt-2">
                                Error: {integration.lastError}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => testMutation.mutate(integration.id)}
                            disabled={testMutation.isPending}
                          >
                            {testMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Test"
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              syncMutation.mutate({ id: integration.id, type: "products" })
                            }
                            disabled={syncMutation.isPending}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Sync
                          </Button>
                          <Link
                            href={`/dashboard/settings/pos-integrations/${integration.id}/mappings`}
                          >
                            <Button variant="outline" size="sm">
                              <Link2 className="h-4 w-4 mr-1" />
                              Mappings
                            </Button>
                          </Link>
                          <Link href={`/dashboard/settings/pos-integrations/${integration.id}`}>
                            <Button variant="outline" size="sm">
                              <Settings className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Available Providers */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Available Providers</CardTitle>
                <CardDescription>
                  Connect additional POS systems to extend your inventory management.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {POS_PROVIDERS.map((provider) => {
                    const isConnected = integrationsQuery.data?.some(
                      (i) => i.provider === provider.id
                    );
                    return (
                      <div
                        key={provider.id}
                        className={`p-4 rounded-lg border ${
                          isConnected ? "bg-slate-50 border-slate-200" : "border-dashed"
                        }`}
                      >
                        <h4 className="font-medium text-slate-900">{provider.name}</h4>
                        <p className="text-sm text-slate-500 mt-1">{provider.description}</p>
                        {isConnected ? (
                          <Badge variant="outline" className="mt-3">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Connected
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => {
                              setSelectedProvider(provider.id);
                              setIsCreateOpen(true);
                            }}
                          >
                            Connect
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Webhooks Tab */}
          <TabsContent value="webhooks">
            <WebhooksTab campgroundId={campgroundId} />
          </TabsContent>

          {/* Sync Logs Tab */}
          <TabsContent value="logs">
            <SyncLogsTab integrations={integrationsQuery.data || []} />
          </TabsContent>
        </Tabs>
      </div>
  );
}

// Webhooks Tab Component
function WebhooksTab({ campgroundId }: { campgroundId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const INVENTORY_EVENTS = [
    { id: "inventory.batch.received", label: "Batch Received", description: "New inventory batch added" },
    { id: "inventory.batch.depleted", label: "Batch Depleted", description: "Batch fully depleted" },
    { id: "inventory.expiration.warning", label: "Expiration Warning", description: "Batch entering warning tier" },
    { id: "inventory.expiration.critical", label: "Expiration Critical", description: "Batch entering critical tier" },
    { id: "inventory.expiration.expired", label: "Batch Expired", description: "Batch has expired" },
    { id: "inventory.low_stock", label: "Low Stock", description: "Product below reorder point" },
    { id: "markdown.rule.applied", label: "Markdown Applied", description: "Auto-markdown rule triggered" },
    { id: "product.price.changed", label: "Price Changed", description: "Product price updated" },
  ];

  const webhooksQuery = useQuery({
    queryKey: ["webhooks", campgroundId],
    queryFn: () => apiClient.listWebhooks(campgroundId),
    enabled: !!campgroundId,
  });

  const createMutation = useMutation({
    mutationFn: () => apiClient.createWebhook(campgroundId, { url, eventTypes: selectedEvents, description }),
    onSuccess: (data) => {
      setCreatedSecret(data.secret);
      qc.invalidateQueries({ queryKey: ["webhooks", campgroundId] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to create webhook", description: err?.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => apiClient.toggleWebhook(id, isActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhooks", campgroundId] });
    },
  });

  const resetDialog = () => {
    setIsCreateOpen(false);
    setUrl("");
    setDescription("");
    setSelectedEvents([]);
    setCreatedSecret(null);
  };

  const toggleEvent = (eventId: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventId) ? prev.filter((e) => e !== eventId) : [...prev, eventId]
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-slate-900">Webhook Endpoints</h3>
          <p className="text-sm text-slate-500">
            Receive real-time notifications for inventory events.
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => !open && resetDialog()}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Endpoint
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Webhook Endpoint</DialogTitle>
              <DialogDescription>
                Enter the URL where you want to receive inventory events.
              </DialogDescription>
            </DialogHeader>

            {createdSecret ? (
              <div className="py-4 space-y-4">
                <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-200">
                  <h4 className="font-medium text-emerald-800 mb-2">Webhook Created!</h4>
                  <p className="text-sm text-emerald-700 mb-3">
                    Save this signing secret - it won't be shown again.
                  </p>
                  <code className="block bg-white p-3 rounded border text-sm font-mono break-all">
                    {createdSecret}
                  </code>
                </div>
                <DialogFooter>
                  <Button onClick={resetDialog}>Done</Button>
                </DialogFooter>
              </div>
            ) : (
              <>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Endpoint URL</Label>
                    <Input
                      type="url"
                      placeholder="https://your-server.com/webhook"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description (optional)</Label>
                    <Input
                      placeholder="e.g., Production webhook"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Events to receive</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {INVENTORY_EVENTS.map((event) => (
                        <label
                          key={event.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedEvents.includes(event.id)
                              ? "border-blue-500 bg-blue-50"
                              : "border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedEvents.includes(event.id)}
                            onChange={() => toggleEvent(event.id)}
                            className="mt-1"
                          />
                          <div>
                            <div className="font-medium text-sm">{event.label}</div>
                            <div className="text-xs text-slate-500">{event.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={resetDialog}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createMutation.mutate()}
                    disabled={!url || selectedEvents.length === 0 || createMutation.isPending}
                  >
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Endpoint
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {webhooksQuery.isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading webhooks...
          </CardContent>
        </Card>
      ) : webhooksQuery.data?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-slate-400 mb-4">
              <ExternalLink className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">No Webhook Endpoints</h3>
            <p className="text-slate-600">
              Create a webhook endpoint to receive real-time inventory notifications.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>URL / Description</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhooksQuery.data?.map((webhook: any) => (
                <TableRow key={webhook.id}>
                  <TableCell>
                    <div className="font-mono text-sm truncate max-w-xs">{webhook.url}</div>
                    {webhook.description && (
                      <div className="text-xs text-slate-500">{webhook.description}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {webhook.eventTypes?.slice(0, 3).map((event: string) => (
                        <Badge key={event} variant="outline" className="text-xs">
                          {event.split(".").pop()}
                        </Badge>
                      ))}
                      {webhook.eventTypes?.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{webhook.eventTypes.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={webhook.isActive ? "default" : "secondary"}>
                      {webhook.isActive ? "Active" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        toggleMutation.mutate({ id: webhook.id, isActive: !webhook.isActive })
                      }
                    >
                      {webhook.isActive ? "Disable" : "Enable"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// Sync Logs Tab Component
function SyncLogsTab({ integrations }: { integrations: Integration[] }) {
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);

  const logsQuery = useQuery({
    queryKey: ["pos-sync-logs", selectedIntegration],
    queryFn: () => apiClient.getSyncLogs(selectedIntegration!, 50),
    enabled: !!selectedIntegration,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-emerald-100 text-emerald-800">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "running":
        return <Badge className="bg-blue-100 text-blue-800">Running</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Label>Select Integration</Label>
          <Select
            value={selectedIntegration ?? ""}
            onValueChange={(v) => setSelectedIntegration(v || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose an integration to view logs..." />
            </SelectTrigger>
            <SelectContent>
              {integrations.map((integration) => (
                <SelectItem key={integration.id} value={integration.id}>
                  {integration.displayName || integration.provider}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedIntegration ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            Select an integration to view sync logs.
          </CardContent>
        </Card>
      ) : logsQuery.isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading logs...
          </CardContent>
        </Card>
      ) : logsQuery.data?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            No sync logs found for this integration.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Errors</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsQuery.data?.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium capitalize">{log.type}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {log.direction}
                    </Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(log.status)}</TableCell>
                  <TableCell>
                    {log.itemsProcessed} processed
                    {log.itemsFailed > 0 && (
                      <span className="text-red-600 ml-1">({log.itemsFailed} failed)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {formatDistanceToNow(new Date(log.startedAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    {log.errors?.length > 0 && (
                      <span className="text-red-600 text-sm">{log.errors.length} errors</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
