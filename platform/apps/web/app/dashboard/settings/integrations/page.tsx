"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";

type ConnectionForm = {
  id?: string;
  campgroundId: string;
  organizationId?: string;
  type: "accounting" | "access_control" | "crm" | "export";
  provider: string;
  status?: string;
  authType?: string;
  webhookSecret?: string;
  credentials?: string;
  settings?: string;
};

export default function IntegrationsSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [campgroundId, setCampgroundId] = useState("");
  const [form, setForm] = useState<ConnectionForm>({
    campgroundId: "",
    type: "accounting",
    provider: "qbo",
  });
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("campreserv:selectedCampground") : null;
    if (stored) {
      setCampgroundId(stored);
      setForm((f) => ({ ...f, campgroundId: stored }));
    }
  }, []);

  const connectionsQuery = useQuery({
    queryKey: ["integrations", campgroundId],
    queryFn: () => apiClient.listIntegrationConnections(campgroundId),
    enabled: !!campgroundId
  });

  const upsertMutation = useMutation({
    mutationFn: async (payload: ConnectionForm) => {
      let parsedCreds: any;
      let parsedSettings: any;
      try {
        parsedCreds = payload.credentials ? JSON.parse(payload.credentials) : undefined;
      } catch (err) {
        throw new Error("Credentials must be valid JSON");
      }
      try {
        parsedSettings = payload.settings ? JSON.parse(payload.settings) : undefined;
      } catch (err) {
        throw new Error("Settings must be valid JSON");
      }
      if (payload.id) {
        return apiClient.updateIntegrationConnection(payload.id, {
          organizationId: payload.organizationId,
          status: payload.status,
          authType: payload.authType,
          credentials: parsedCreds,
          settings: parsedSettings,
          webhookSecret: payload.webhookSecret
        });
      }
      return apiClient.upsertIntegrationConnection({
        campgroundId: payload.campgroundId,
        organizationId: payload.organizationId,
        type: payload.type,
        provider: payload.provider,
        status: payload.status,
        authType: payload.authType,
        credentials: parsedCreds,
        settings: parsedSettings,
        webhookSecret: payload.webhookSecret
      });
    },
    onSuccess: () => {
      toast({ title: "Saved connection" });
      qc.invalidateQueries({ queryKey: ["integrations", campgroundId] });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err?.message ?? "Unknown error", variant: "destructive" });
    }
  });

  const syncMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => apiClient.triggerIntegrationSync(id, { note: "Manual sync" }),
    onSuccess: () => {
      toast({ title: "Sync queued" });
      qc.invalidateQueries({ queryKey: ["integrations", campgroundId] });
    },
    onError: (err: any) => {
      toast({ title: "Sync failed", description: err?.message ?? "Unknown error", variant: "destructive" });
    }
  });

  const selectedConnection = useMemo(() => {
    return connectionsQuery.data?.find((c) => c.id === selectedConnectionId) ?? null;
  }, [connectionsQuery.data, selectedConnectionId]);

  const logsQuery = useQuery({
    queryKey: ["integration-logs", selectedConnectionId],
    queryFn: () => apiClient.listIntegrationLogs(selectedConnectionId!, { limit: 20 }),
    enabled: !!selectedConnectionId
  });

  const webhooksQuery = useQuery({
    queryKey: ["integration-webhooks", selectedConnectionId],
    queryFn: () => apiClient.listIntegrationWebhooks(selectedConnectionId!, { limit: 20 }),
    enabled: !!selectedConnectionId
  });

  const exportsMutation = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      apiClient.queueIntegrationExport({ type: "api", connectionId: id, campgroundId }),
    onSuccess: () => toast({ title: "Export queued" }),
    onError: (err: any) =>
      toast({ title: "Export failed", description: err?.message ?? "Unknown error", variant: "destructive" })
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.campgroundId) {
      toast({ title: "Campground required", variant: "destructive" });
      return;
    }
    upsertMutation.mutate(form);
  };

  return (
    <div>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
            <p className="text-slate-600">Manage accounting, access control, CRM, and export connections.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Provider hints</CardTitle>
            <CardDescription>Sandbox wiring available for QBO; others stay generic until creds are approved.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-700 space-y-1">
            <div>• QBO sandbox: set provider=qbo, type=accounting. Settings JSON: {"{"}"realmId":"sandbox-realm-id"{"}"}. Credentials JSON can include tokens/clientId/secret (sandbox only).</div>
            <div>• Webhook HMAC: set per-connection `webhookSecret` or env `INTEGRATIONS_WEBHOOK_SECRET`.</div>
            <div>• Exports: queue via "Queue export" to test API/SFTP job records.</div>
            <div>• Required envs: `QBO_SANDBOX_TOKEN`, `QBO_SANDBOX_REALMID` (optional: `QBO_SANDBOX_BASE`, `INTEGRATIONS_SANDBOX_ENABLED`).</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connection</CardTitle>
            <CardDescription>Create or update a connection; credentials/settings accept JSON.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Campground ID</Label>
                <Input
                  value={form.campgroundId}
                  onChange={(e) => setForm({ ...form, campgroundId: e.target.value })}
                  placeholder="campground id"
                />
              </div>
              <div>
                <Label>Organization ID</Label>
                <Input
                  value={form.organizationId ?? ""}
                  onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
                  placeholder="optional"
                />
              </div>
              <div>
                <Label>Type</Label>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as ConnectionForm["type"] })}
                >
                  <option value="accounting">Accounting</option>
                  <option value="access_control">Access control</option>
                  <option value="crm">CRM/helpdesk</option>
                  <option value="export">Exports</option>
                </select>
              </div>
              <div>
                <Label>Provider</Label>
                <Input
                  value={form.provider}
                  onChange={(e) => setForm({ ...form, provider: e.target.value })}
                  placeholder="qbo | xero | hubspot | intercom | zendesk | sftp"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Input
                  value={form.status ?? ""}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  placeholder="connected | disconnected | pending | error"
                />
              </div>
              <div>
                <Label>Auth type</Label>
                <Input
                  value={form.authType ?? ""}
                  onChange={(e) => setForm({ ...form, authType: e.target.value })}
                  placeholder="oauth | api_key | basic | sftp"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Webhook secret</Label>
                <Input
                  value={form.webhookSecret ?? ""}
                  onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
                  placeholder="optional HMAC secret"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Credentials (JSON)</Label>
                <Input
                  value={form.credentials ?? ""}
                  onChange={(e) => setForm({ ...form, credentials: e.target.value })}
                  placeholder='{"clientId":"...","clientSecret":"..."}'
                />
              </div>
              <div className="md:col-span-2">
                <Label>Settings (JSON)</Label>
                <Input
                  value={form.settings ?? ""}
                  onChange={(e) => setForm({ ...form, settings: e.target.value })}
                  placeholder='{"realmId":"...","region":"us"}'
                />
              </div>
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit" disabled={upsertMutation.isPending}>
                  {form.id ? "Update" : "Create"} connection
                </Button>
                {form.id && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setForm({
                        campgroundId: campgroundId,
                        type: "accounting",
                        provider: "qbo"
                      });
                      setSelectedConnectionId(null);
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connections</CardTitle>
            <CardDescription>Existing connections for this campground.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {connectionsQuery.isLoading && <div>Loading...</div>}
            {!connectionsQuery.isLoading && (connectionsQuery.data?.length ?? 0) === 0 && (
              <div className="text-slate-500">No connections yet.</div>
            )}
            {connectionsQuery.data?.map((c) => (
              <div key={c.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{c.provider}</span>
                      <Badge variant={c.status === "connected" ? "default" : "secondary"}>{c.status}</Badge>
                      <Badge variant="outline">{c.type}</Badge>
                    </div>
                    <div className="text-sm text-slate-500">
                      Last sync: {c.lastSyncAt ?? "—"} {c.lastError ? ` • Error: ${c.lastError}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => syncMutation.mutate({ id: c.id })} disabled={syncMutation.isPending}>
                      Queue sync
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => exportsMutation.mutate({ id: c.id })}>
                      Queue export
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedConnectionId(c.id);
                        setForm({
                          id: c.id,
                          campgroundId: c.campgroundId || campgroundId,
                          organizationId: c.organizationId || "",
                          type: c.type as ConnectionForm["type"],
                          provider: c.provider,
                          status: c.status,
                          authType: c.authType || "",
                          webhookSecret: c.webhookSecret || "",
                          credentials: c.credentials ? JSON.stringify(c.credentials) : "",
                          settings: c.settings ? JSON.stringify(c.settings) : ""
                        });
                      }}
                    >
                      View
                    </Button>
                  </div>
                </div>
                {c.logs && c.logs.length > 0 && (
                  <div className="text-sm text-slate-600">
                    Last log: {c.logs[0].status} — {c.logs[0].message ?? "No message"} at {c.logs[0].occurredAt}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {selectedConnection && (
          <Card>
            <CardHeader>
              <CardTitle>{selectedConnection.provider} debug</CardTitle>
              <CardDescription>Logs, webhooks, and actions</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="logs">
                <TabsList>
                  <TabsTrigger value="logs">Sync logs</TabsTrigger>
                  <TabsTrigger value="webhooks">Webhook events</TabsTrigger>
                </TabsList>
                <TabsContent value="logs" className="mt-4 space-y-2">
                  {logsQuery.isLoading && <div>Loading logs...</div>}
                  {logsQuery.data?.items.map((l) => (
                    <div key={l.id} className="rounded border px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{l.direction}</Badge>
                        <Badge variant={l.status === "success" ? "default" : "secondary"}>{l.status}</Badge>
                        <span className="text-slate-500">{l.scope}</span>
                      </div>
                      <div className="text-slate-700">{l.message ?? "No message"}</div>
                      <div className="text-xs text-slate-500">{l.occurredAt}</div>
                    </div>
                  ))}
                  {logsQuery.data?.nextCursor && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const next = await apiClient.listIntegrationLogs(selectedConnectionId!, {
                          limit: 20,
                          cursor: logsQuery.data?.nextCursor || undefined
                        });
                        if (next.items.length > 0) {
                          const merged = {
                            items: [...(logsQuery.data?.items ?? []), ...next.items],
                            nextCursor: next.nextCursor
                          };
                          qc.setQueryData(["integration-logs", selectedConnectionId], merged);
                        }
                      }}
                    >
                      Load more
                    </Button>
                  )}
                  {!logsQuery.isLoading && (logsQuery.data?.items.length ?? 0) === 0 && (
                    <div className="text-slate-500 text-sm">No logs yet.</div>
                  )}
                </TabsContent>
                <TabsContent value="webhooks" className="mt-4 space-y-2">
                  {webhooksQuery.isLoading && <div>Loading webhook events...</div>}
                  {webhooksQuery.data?.items.map((w) => (
                    <div key={w.id} className="rounded border px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{w.provider}</Badge>
                        <Badge variant={w.signatureValid ? "default" : "destructive"}>
                          {w.signatureValid ? "verified" : "invalid"}
                        </Badge>
                        <span className="text-slate-500">{w.eventType ?? "unknown"}</span>
                      </div>
                      <div className="text-slate-700">{w.message ?? "No message"}</div>
                      <div className="text-xs text-slate-500">{w.receivedAt}</div>
                    </div>
                  ))}
                  {webhooksQuery.data?.nextCursor && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const next = await apiClient.listIntegrationWebhooks(selectedConnectionId!, {
                          limit: 20,
                          cursor: webhooksQuery.data?.nextCursor || undefined
                        });
                        if (next.items.length > 0) {
                          const merged = {
                            items: [...(webhooksQuery.data?.items ?? []), ...next.items],
                            nextCursor: next.nextCursor
                          };
                          qc.setQueryData(["integration-webhooks", selectedConnectionId], merged);
                        }
                      }}
                    >
                      Load more
                    </Button>
                  )}
                  {!webhooksQuery.isLoading && (webhooksQuery.data?.items.length ?? 0) === 0 && (
                    <div className="text-slate-500 text-sm">No webhook events yet.</div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Checklist</CardTitle>
            <CardDescription>Quick reminders for provider wiring.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <div>• Set `INTEGRATIONS_WEBHOOK_SECRET` or per-connection `webhookSecret`.</div>
            <div>• Use sandbox client IDs/secrets for QBO/Xero/CRM until prod approvals land.</div>
            <div>• Map scopes per provider (accounting, access_control, crm, export) and store realm/site IDs in settings.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

