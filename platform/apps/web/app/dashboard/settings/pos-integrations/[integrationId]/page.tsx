"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import {
  ArrowLeft,
  Settings,
  RefreshCw,
  Link2,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  Zap,
} from "lucide-react";
import Link from "next/link";

// Provider configurations with credential fields
const PROVIDER_CONFIG: Record<
  string,
  {
    name: string;
    logo?: string;
    fields: {
      key: string;
      label: string;
      type: string;
      placeholder?: string;
      required: boolean;
      description?: string;
    }[];
    syncOptions: {
      key: string;
      label: string;
      description: string;
    }[];
  }
> = {
  LIGHTSPEED: {
    name: "Lightspeed R-Series",
    fields: [
      {
        key: "accountId",
        label: "Account ID",
        type: "text",
        required: true,
        description: "Your Lightspeed account identifier",
      },
      {
        key: "accessToken",
        label: "Access Token",
        type: "password",
        required: true,
        description: "API access token from Lightspeed",
      },
    ],
    syncOptions: [
      {
        key: "syncProducts",
        label: "Sync Products",
        description: "Import and sync product catalog from Lightspeed",
      },
      {
        key: "syncInventory",
        label: "Sync Inventory",
        description: "Push inventory changes to Lightspeed",
      },
      {
        key: "syncSales",
        label: "Sync Sales",
        description: "Pull sales data from Lightspeed",
      },
    ],
  },
  SHOPIFY_POS: {
    name: "Shopify POS",
    fields: [
      {
        key: "shopDomain",
        label: "Shop Domain",
        type: "text",
        placeholder: "mystore.myshopify.com",
        required: true,
        description: "Your Shopify store domain",
      },
      {
        key: "accessToken",
        label: "Access Token",
        type: "password",
        required: true,
        description: "Private app API access token",
      },
      {
        key: "locationId",
        label: "Default Location ID",
        type: "text",
        required: false,
        description: "Leave blank to use primary location",
      },
    ],
    syncOptions: [
      {
        key: "syncProducts",
        label: "Sync Products",
        description: "Import and sync products from Shopify",
      },
      {
        key: "syncInventory",
        label: "Sync Inventory",
        description: "Push inventory levels to Shopify",
      },
      {
        key: "syncSales",
        label: "Sync Sales",
        description: "Pull order data from Shopify POS",
      },
    ],
  },
  VEND: {
    name: "Vend (Lightspeed X-Series)",
    fields: [
      {
        key: "domainPrefix",
        label: "Domain Prefix",
        type: "text",
        placeholder: "yourstore",
        required: true,
        description: "Your Vend store name (yourstore.vendhq.com)",
      },
      {
        key: "accessToken",
        label: "Access Token",
        type: "password",
        required: true,
        description: "Personal token from Vend settings",
      },
      {
        key: "defaultOutletId",
        label: "Default Outlet ID",
        type: "text",
        required: false,
        description: "Leave blank to use primary outlet",
      },
    ],
    syncOptions: [
      {
        key: "syncProducts",
        label: "Sync Products",
        description: "Import and sync products from Vend",
      },
      {
        key: "syncInventory",
        label: "Sync Inventory",
        description: "Push inventory changes to Vend",
      },
      {
        key: "syncSales",
        label: "Sync Sales",
        description: "Pull sales data from Vend",
      },
    ],
  },
};

export default function PosIntegrationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const integrationId = params.integrationId as string;

  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [syncSettings, setSyncSettings] = useState<Record<string, boolean>>({});
  const [isTesting, setIsTesting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Fetch integration details
  const { data: integration, isLoading } = useQuery({
    queryKey: ["pos-integration", integrationId],
    queryFn: () => apiClient.getPosIntegration(integrationId),
    enabled: !!integrationId,
  });

  // Update credentials/settings state when integration loads
  useEffect(() => {
    if (integration?.credentials) {
      setCredentials(integration.credentials as Record<string, string>);
    }
    if (integration?.settings) {
      setSyncSettings(integration.settings as Record<string, boolean>);
    }
  }, [integration]);

  // Update integration mutation
  const updateMutation = useMutation({
    mutationFn: (payload: { credentials?: Record<string, string>; settings?: Record<string, boolean> }) =>
      apiClient.updatePosIntegration(integrationId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-integration", integrationId] });
      toast({
        title: "Settings saved",
        description: "Your integration settings have been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: () => apiClient.testPosConnection(integrationId),
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: "Connection successful",
          description: "Your POS integration is working correctly.",
        });
      } else {
        toast({
          title: "Connection failed",
          description: result.message || "Could not connect to POS system",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Connection test failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Trigger sync mutation
  const syncMutation = useMutation({
    mutationFn: (type: "products" | "inventory" | "sales") =>
      apiClient.triggerPosSync(integrationId, type),
    onSuccess: (_, type) => {
      queryClient.invalidateQueries({ queryKey: ["pos-integration", integrationId] });
      toast({
        title: "Sync started",
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} sync has been initiated.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete integration mutation
  const deleteMutation = useMutation({
    mutationFn: () => apiClient.deletePosIntegration(integrationId),
    onSuccess: () => {
      toast({
        title: "Integration removed",
        description: "The POS integration has been disconnected.",
      });
      router.push("/dashboard/settings/pos-integrations");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!integration) {
    return (
      <div>
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <p className="text-muted-foreground">Integration not found</p>
          <Button asChild variant="outline">
            <Link href="/dashboard/settings/pos-integrations">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Integrations
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const providerConfig = PROVIDER_CONFIG[integration.provider] || {
    name: integration.provider,
    fields: [],
    syncOptions: [],
  };

  const handleSave = () => {
    updateMutation.mutate({ credentials, settings: syncSettings });
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    await testMutation.mutateAsync();
    setIsTesting(false);
  };

  return (
    <div>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link href="/dashboard/settings/pos-integrations">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{providerConfig.name}</h1>
              <p className="text-muted-foreground">
                Configure your POS integration settings
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={integration.status === "CONNECTED" ? "default" : "secondary"}
              className={
                integration.status === "CONNECTED"
                  ? "bg-green-100 text-green-800"
                  : integration.status === "ERROR"
                  ? "bg-red-100 text-red-800"
                  : ""
              }
            >
              {integration.status === "CONNECTED" && (
                <CheckCircle className="mr-1 h-3 w-3" />
              )}
              {integration.status === "ERROR" && (
                <XCircle className="mr-1 h-3 w-3" />
              )}
              {integration.status}
            </Badge>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Credentials Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Connection Settings
              </CardTitle>
              <CardDescription>
                API credentials for connecting to {providerConfig.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {providerConfig.fields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  <Input
                    id={field.key}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={credentials[field.key] || ""}
                    onChange={(e) =>
                      setCredentials({ ...credentials, [field.key]: e.target.value })
                    }
                  />
                  {field.description && (
                    <p className="text-xs text-muted-foreground">{field.description}</p>
                  )}
                </div>
              ))}

              <Separator className="my-4" />

              <div className="flex gap-2">
                <Button
                  onClick={handleTestConnection}
                  variant="outline"
                  disabled={isTesting}
                >
                  {isTesting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="mr-2 h-4 w-4" />
                  )}
                  Test Connection
                </Button>
                <Button onClick={handleSave} disabled={updateMutation.isPending}>
                  {updateMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sync Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Sync Configuration
              </CardTitle>
              <CardDescription>
                Choose what data to sync with {providerConfig.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {providerConfig.syncOptions.map((option) => (
                <div
                  key={option.key}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="space-y-0.5">
                    <Label htmlFor={option.key}>{option.label}</Label>
                    <p className="text-sm text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                  <Switch
                    id={option.key}
                    checked={syncSettings[option.key] ?? true}
                    onCheckedChange={(checked) =>
                      setSyncSettings({ ...syncSettings, [option.key]: checked })
                    }
                  />
                </div>
              ))}

              <Separator className="my-4" />

              <div className="space-y-2">
                <Label>Last Sync</Label>
                <p className="text-sm text-muted-foreground">
                  {integration.lastSyncAt
                    ? new Date(integration.lastSyncAt).toLocaleString()
                    : "Never synced"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Quick Actions
              </CardTitle>
              <CardDescription>
                Manually trigger sync operations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => syncMutation.mutate("products")}
                disabled={syncMutation.isPending}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Products Now
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => syncMutation.mutate("inventory")}
                disabled={syncMutation.isPending}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Push Inventory Updates
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => syncMutation.mutate("sales")}
                disabled={syncMutation.isPending}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Pull Sales Data
              </Button>
              <Separator />
              <Button
                variant="outline"
                className="w-full justify-start"
                asChild
              >
                <Link href={`/dashboard/settings/pos-integrations/${integrationId}/mappings`}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Manage Product Mappings
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Danger Zone Card */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Irreversible actions for this integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Disconnect Integration
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Disconnect {providerConfig.name}?</DialogTitle>
                    <DialogDescription>
                      This will remove all connection settings and product mappings.
                      Your data in {providerConfig.name} will not be affected, but
                      sync will stop immediately.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        deleteMutation.mutate();
                        setDeleteDialogOpen(false);
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Disconnect
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
