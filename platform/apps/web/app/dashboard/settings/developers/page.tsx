"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Copy,
  Plus,
  RefreshCw,
  Trash2,
  Code2,
  Key,
  Shield,
  CheckCircle2,
  ExternalLink,
  BookOpen,
  Zap,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Sparkles,
  Terminal,
  Webhook,
  Clock,
} from "lucide-react";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { format, formatDistanceToNow } from "date-fns";

// Animation variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const successVariants: Variants = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 20 },
  },
};

// Feature cards for empty state
const features = [
  {
    icon: Webhook,
    title: "Webhooks",
    description: "Get real-time notifications for bookings, check-ins, and payments",
  },
  {
    icon: Terminal,
    title: "REST API",
    description: "Full access to reservations, sites, guests, and reporting data",
  },
  {
    icon: Zap,
    title: "Automation",
    description: "Build custom integrations with your existing tools and workflows",
  },
];

// Code example for documentation
const codeExample = `// Authenticate with your API key
const response = await fetch('https://api.campreserv.com/v1/reservations', {
  headers: {
    'Authorization': 'Bearer YOUR_CLIENT_SECRET',
    'X-Client-ID': 'YOUR_CLIENT_ID'
  }
});

const reservations = await response.json();`;

export default function DevelopersSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [createdClientSecret, setCreatedClientSecret] = useState<string | null>(null);
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showDocs, setShowDocs] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setCampgroundId(stored);
  }, []);

  const { data: clients, isLoading } = useQuery<
    Array<{
      id: string;
      name: string;
      clientId: string;
      isActive: boolean;
      createdAt: string;
      lastUsedAt?: string | null;
    }>
  >({
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
      setNewClientName("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create API client", variant: "destructive" });
    },
  });

  const rotateMutation = useMutation({
    mutationFn: async (clientId: string) => {
      return apiClient.rotateApiClientSecret(clientId, campgroundId!);
    },
    onSuccess: (data) => {
      setCreatedClientSecret(data.clientSecret);
      setCreatedClientId(data.client.clientId);
      setIsCreateOpen(true);
      toast({
        title: "Secret rotated successfully",
        description: "Your previous secret is now invalid.",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiClient.toggleApiClient(id, isActive, campgroundId!);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["api-clients"] });
      toast({
        title: variables.isActive ? "API key activated" : "API key deactivated",
        description: variables.isActive
          ? "This key can now be used to access the API."
          : "This key will no longer work until reactivated.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClient.deleteApiClient(id, campgroundId!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-clients"] });
      toast({ title: "API key deleted", description: "The key has been permanently removed." });
    },
  });

  const handleCreate = () => {
    if (!newClientName.trim()) return;
    createMutation.mutate(newClientName);
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const resetCreateDialog = () => {
    setIsCreateOpen(false);
    setNewClientName("");
    setCreatedClientSecret(null);
    setCreatedClientId(null);
    setShowSecret(false);
  };

  const isFirstKey = clients?.length === 0;

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ label: "Settings" }, { label: "Developers & API" }]} />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-info/15 text-status-info">
              <Code2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Developer API</h1>
              <p className="text-muted-foreground">
                Build custom integrations and automate your campground operations
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setShowDocs(!showDocs)} className="gap-2">
            <BookOpen className="h-4 w-4" />
            {showDocs ? "Hide Docs" : "View Docs"}
          </Button>

          <Dialog open={isCreateOpen} onOpenChange={(open) => !open && resetCreateDialog()}>
            <DialogTrigger asChild>
              <Button
                onClick={() => setIsCreateOpen(true)}
                disabled={!campgroundId}
                className="gap-2 bg-action-primary text-action-primary-foreground hover:bg-action-primary-hover shadow-sm transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create API Key
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {createdClientSecret ? (
                    <>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-status-success/15 text-status-success"
                      >
                        <CheckCircle2 className="h-5 w-5" />
                      </motion.div>
                      API Key Created!
                    </>
                  ) : (
                    <>
                      <Key className="h-5 w-5 text-violet-600" />
                      Create New API Key
                    </>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {createdClientSecret
                    ? "Your API credentials are ready. Make sure to copy the secret now—it won't be shown again."
                    : "Create credentials to authenticate your integration with the CampReserv API."}
                </DialogDescription>
              </DialogHeader>

              <AnimatePresence mode="wait">
                {createdClientSecret ? (
                  <motion.div
                    key="success"
                    variants={successVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-4 py-4"
                  >
                    {/* Client ID */}
                    <div className="space-y-2">
                      <Label htmlFor="client-id" className="text-sm font-medium">
                        Client ID
                      </Label>
                      <div className="flex items-center gap-2">
                        <code
                          id="client-id"
                          className="flex-1 rounded-lg bg-muted px-3 py-2.5 font-mono text-sm"
                        >
                          {createdClientId}
                        </code>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => copyToClipboard(createdClientId!, "clientId")}
                          aria-label="Copy Client ID"
                          className="shrink-0 transition-colors"
                        >
                          {copiedField === "clientId" ? (
                            <CheckCircle2 className="h-4 w-4 text-status-success" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Client Secret */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="client-secret"
                        className="text-sm font-medium flex items-center gap-2"
                      >
                        Client Secret
                        <span className="inline-flex items-center gap-1 rounded-full bg-status-warning/15 text-status-warning px-2 py-0.5 text-xs font-medium">
                          <AlertTriangle className="h-3 w-3" />
                          Copy now
                        </span>
                      </Label>
                      <div className="flex items-center gap-2">
                        <div
                          id="client-secret"
                          className="flex-1 rounded-lg border-2 border-amber-200 bg-amber-50 px-3 py-2.5 font-mono text-sm text-amber-900"
                        >
                          {showSecret ? createdClientSecret : "•".repeat(40)}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setShowSecret(!showSecret)}
                          aria-label={showSecret ? "Hide secret" : "Show secret"}
                          className="shrink-0"
                        >
                          {showSecret ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => copyToClipboard(createdClientSecret!, "secret")}
                          aria-label="Copy Client Secret"
                          className="shrink-0"
                        >
                          {copiedField === "secret" ? (
                            <CheckCircle2 className="h-4 w-4 text-status-success" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                        Store this securely. For security reasons, we can't show it again.
                      </p>
                    </div>

                    {/* Security tips */}
                    <div className="rounded-lg bg-muted p-4">
                      <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <Shield className="h-4 w-4 text-violet-600" />
                        Security Best Practices
                      </h4>
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        <li>• Never commit secrets to version control</li>
                        <li>• Use environment variables in production</li>
                        <li>• Rotate secrets regularly (every 90 days)</li>
                      </ul>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4 py-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="client-name">Integration Name</Label>
                      <Input
                        id="client-name"
                        placeholder="e.g., Website Booking Widget, Mobile App, Zapier"
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                        aria-describedby="client-name-hint"
                      />
                      <p id="client-name-hint" className="text-xs text-muted-foreground">
                        Choose a descriptive name to identify this integration later
                      </p>
                    </div>

                    {isFirstKey && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="flex items-start gap-3 rounded-lg bg-violet-50 p-4"
                      >
                        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
                        <div>
                          <p className="text-sm font-medium text-violet-900">Your first API key!</p>
                          <p className="text-xs text-violet-700">
                            This will unlock the full power of the CampReserv API.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <DialogFooter>
                {createdClientSecret ? (
                  <Button onClick={resetCreateDialog} className="w-full sm:w-auto">
                    Done
                  </Button>
                ) : (
                  <Button
                    onClick={handleCreate}
                    disabled={createMutation.isPending || !newClientName.trim()}
                    className="w-full gap-2 sm:w-auto"
                  >
                    {createMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Key className="h-4 w-4" />
                        Generate Credentials
                      </>
                    )}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* Documentation Panel */}
      <AnimatePresence>
        {showDocs && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <Terminal className="h-5 w-5 text-status-info" />
                  Quick Start Guide
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-action-primary hover:text-action-primary-hover"
                  asChild
                >
                  <a
                    href="https://docs.campreserv.com/api"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Full Documentation
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="mb-2 text-sm font-medium text-muted-foreground">Authentication</h4>
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs text-foreground">
                    <code>{codeExample}</code>
                  </pre>
                </div>
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground">Available Endpoints</h4>
                  <div className="space-y-2">
                    {[
                      { method: "GET", path: "/reservations", desc: "List reservations" },
                      { method: "POST", path: "/reservations", desc: "Create booking" },
                      { method: "GET", path: "/sites", desc: "List available sites" },
                      { method: "GET", path: "/availability", desc: "Check availability" },
                    ].map((endpoint) => (
                      <div key={endpoint.path} className="flex items-center gap-2 text-sm">
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-xs font-medium ${
                            endpoint.method === "GET"
                              ? "bg-status-success/15 text-status-success"
                              : "bg-status-info/15 text-status-info"
                          }`}
                        >
                          {endpoint.method}
                        </span>
                        <code className="text-muted-foreground">{endpoint.path}</code>
                        <span className="text-muted-foreground">—</span>
                        <span className="text-muted-foreground">{endpoint.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State or Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : clients?.length === 0 ? (
        /* Empty State */
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="rounded-xl border border-dashed border-border bg-card p-12 text-center"
        >
          <motion.div
            variants={itemVariants}
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-status-info/15 text-status-info"
          >
            <Code2 className="h-8 w-8" />
          </motion.div>

          <motion.h2 variants={itemVariants} className="mb-2 text-xl font-semibold">
            Build Something Amazing
          </motion.h2>
          <motion.p variants={itemVariants} className="mx-auto mb-8 max-w-md text-muted-foreground">
            Create your first API key to start building custom integrations, automate workflows, or
            connect third-party apps.
          </motion.p>

          <motion.div variants={itemVariants} className="mb-8 grid gap-4 sm:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-lg border border-border bg-card p-4 text-left transition-shadow hover:shadow-md"
              >
                <feature.icon className="mb-2 h-5 w-5 text-status-info" />
                <h3 className="mb-1 font-medium">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </motion.div>

          <motion.div variants={itemVariants}>
            <Button
              size="lg"
              onClick={() => setIsCreateOpen(true)}
              disabled={!campgroundId}
              className="gap-2 bg-action-primary text-action-primary-foreground hover:bg-action-primary-hover shadow-sm"
            >
              <Key className="h-4 w-4" />
              Create Your First API Key
            </Button>
          </motion.div>
        </motion.div>
      ) : (
        /* API Keys Table */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border bg-card shadow-sm"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Integration</TableHead>
                <TableHead>Client ID</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients?.map((client, index) => (
                <motion.tr
                  key={client.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group"
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                          client.isActive
                            ? "bg-violet-100 text-violet-600"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Key className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">{client.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {client.isActive ? "Ready to use" : "Deactivated"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
                        {client.clientId}
                      </code>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => copyToClipboard(client.clientId, `id-${client.id}`)}
                        aria-label="Copy Client ID"
                      >
                        {copiedField === `id-${client.id}` ? (
                          <CheckCircle2 className="h-3 w-3 text-status-success" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {format(new Date(client.createdAt), "MMM d, yyyy")}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {client.lastUsedAt ? (
                      formatDistanceToNow(new Date(client.lastUsedAt), { addSuffix: true })
                    ) : (
                      <span className="text-muted-foreground">Never</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={client.isActive}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: client.id, isActive: checked })
                        }
                        aria-label={`${client.isActive ? "Deactivate" : "Activate"} ${client.name}`}
                      />
                      <span
                        className={`text-xs font-medium ${
                          client.isActive ? "text-status-success" : "text-muted-foreground"
                        }`}
                      >
                        {client.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Rotate Secret"
                            aria-label={`Rotate secret for ${client.name}`}
                          >
                            <RefreshCw className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        }
                        title="Rotate client secret?"
                        description="The old secret will stop working immediately. Make sure to update your integrations with the new secret."
                        confirmLabel="Rotate"
                        onConfirm={() => rotateMutation.mutate(client.id)}
                        isPending={rotateMutation.isPending}
                      />
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-status-error/15 hover:text-status-error"
                            title="Delete"
                            aria-label={`Delete ${client.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                        title="Delete API key?"
                        description="This action is permanent. Any integrations using this key will stop working immediately."
                        confirmLabel="Delete"
                        variant="destructive"
                        onConfirm={() => deleteMutation.mutate(client.id)}
                        isPending={deleteMutation.isPending}
                      />
                    </div>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>

          {/* Rate Limit Info */}
          <div className="border-t bg-muted px-6 py-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="h-4 w-4" />
                <span>Rate limit: 1,000 requests/minute per key</span>
              </div>
              <Button variant="ghost" size="sm" className="gap-1 text-violet-600" asChild>
                <a
                  href="https://docs.campreserv.com/api/rate-limits"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Learn more
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
