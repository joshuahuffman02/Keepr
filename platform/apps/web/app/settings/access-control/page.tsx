"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { DashboardShell } from "../../../components/ui/layout/DashboardShell";
import { Badge } from "../../../components/ui/badge";
import { DoorOpen, KeyRound, RefreshCcw } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Button } from "../../../components/ui/button";
import { useToast } from "../../../components/ui/use-toast";

const PROVIDERS = ["kisi", "brivo", "cloudkey"] as const;

export default function AccessControlSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: whoami, isLoading: whoamiLoading } = useQuery({
    queryKey: ["whoami"],
    queryFn: apiClient.getWhoami
  });

  const campgroundId = useMemo(
    () => whoami?.user?.memberships?.[0]?.campgroundId ?? null,
    [whoami?.user?.memberships]
  );

  const allowed = useMemo(
    () => Boolean(whoami?.user?.platformRole || (whoami?.user?.memberships?.length ?? 0) > 0),
    [whoami]
  );

  const providersQuery = useQuery({
    queryKey: ["access-providers", campgroundId],
    queryFn: () => apiClient.listAccessProviders(campgroundId as string),
    enabled: !!campgroundId && allowed
  });

  const [selectedProvider, setSelectedProvider] = useState<(typeof PROVIDERS)[number]>("kisi");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState("enabled");
  const [credentialsText, setCredentialsText] = useState("{}");
  const [webhookSecret, setWebhookSecret] = useState("");

  useEffect(() => {
    const match = providersQuery.data?.find((p) => p.provider === selectedProvider);
    setDisplayName(match?.displayName ?? "");
    setStatus(match?.status ?? "enabled");
    setWebhookSecret(match?.webhookSecret ?? "");
    setCredentialsText(JSON.stringify(match?.credentials ?? {}, null, 2));
  }, [providersQuery.data, selectedProvider]);

  const saveMutation = useMutation({
    mutationFn: (payload: { displayName?: string; status?: string; credentials: any; webhookSecret?: string }) =>
      apiClient.upsertAccessProvider(campgroundId as string, selectedProvider, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-providers", campgroundId] });
      toast({ title: "Saved", description: "Access provider updated." });
    },
    onError: (err: any) => {
      toast({
        title: "Save failed",
        description: err?.message ?? "Could not save provider",
        variant: "destructive"
      });
    }
  });

  const handleSave = () => {
    let credentials: any = {};
    try {
      credentials = credentialsText ? JSON.parse(credentialsText) : {};
    } catch (err: any) {
      toast({ title: "Invalid JSON", description: err?.message ?? "Check credentials JSON", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      displayName: displayName || undefined,
      status: status || undefined,
      webhookSecret: webhookSecret || undefined,
      credentials
    });
  };

  if (whoamiLoading) {
    return (
      <DashboardShell>
        <div className="text-sm text-slate-600">Loading access control…</div>
      </DashboardShell>
    );
  }

  if (!allowed || !campgroundId) {
    return (
      <DashboardShell>
        <div className="text-sm text-slate-600">Access control is restricted to authorized users.</div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Access Control</h1>
          <p className="text-sm text-slate-600">
            Configure gate/lock providers (Kisi, Brivo, CloudKey), credentials, and webhook secrets per campground.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["access-providers", campgroundId] })}
        >
          <RefreshCcw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="flex items-center gap-2">
          <DoorOpen className="h-4 w-4 text-emerald-600" />
          <CardTitle>Provider setup</CardTitle>
          <Badge variant="outline">Per-campground</Badge>
        </CardHeader>
        <CardContent className="text-sm text-slate-700 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Provider</Label>
              <select
                className="border border-slate-200 rounded px-2 py-1 text-sm"
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as any)}
              >
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {p.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Display name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Front gate" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Status</Label>
              <select
                className="border border-slate-200 rounded px-2 py-1 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="enabled">enabled</option>
                <option value="disabled">disabled</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500 flex items-center gap-1">
                Webhook secret <KeyRound className="h-3 w-3" />
              </Label>
              <Input
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="Secret used to verify signatures"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Credentials (JSON)</Label>
            <Textarea
              className="font-mono text-xs"
              rows={10}
              value={credentialsText}
              onChange={(e) => setCredentialsText(e.target.value)}
            />
            <p className="text-[11px] text-slate-500">
              Store API keys, org/site ids, or other provider config. This is saved server-side.
            </p>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save provider"}
            </Button>
          </div>

          <div className="border-t pt-3 space-y-2">
            <div className="text-xs text-slate-500">
              Webhook endpoint: <code className="bg-slate-50 px-1 py-0.5 rounded">/api/access/webhooks/{selectedProvider}</code>
            </div>
            <div className="text-xs text-slate-500">
              Pass <code className="bg-slate-50 px-1 py-0.5 rounded">x-signature</code> with HMAC of raw body.
            </div>
          </div>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
