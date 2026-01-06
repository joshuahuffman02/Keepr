"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { DoorOpen, KeyRound, RefreshCcw } from "lucide-react";
import { apiClient } from "../../../../lib/api-client";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select";
import { Textarea } from "../../../../components/ui/textarea";
import { Button } from "../../../../components/ui/button";
import { useToast } from "../../../../components/ui/use-toast";

const PROVIDERS = ["kisi", "brivo", "cloudkey"] as const;

export default function AccessControlSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: whoami, isLoading: whoamiLoading } = useQuery({
    queryKey: ["whoami"],
    queryFn: () => apiClient.getWhoami()
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
    let credentials: Record<string, unknown> = {};
    try {
      credentials = credentialsText ? JSON.parse(credentialsText) : {};
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Check credentials JSON";
      toast({ title: "Invalid JSON", description: errorMessage, variant: "destructive" });
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
      <div>
        <div className="text-sm text-muted-foreground">Loading access control…</div>
      </div>
    );
  }

  if (!allowed || !campgroundId) {
    return (
      <div>
        <div className="text-sm text-muted-foreground">Access control is restricted to authorized users.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Access Control</h1>
          <p className="text-sm text-muted-foreground">
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

      {/* How It Works Section */}
      <Card className="bg-status-info/10 border-status-info/20 mb-4">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <DoorOpen className="w-5 h-5 text-status-info mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">How Access Control Works</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Supported Providers:</strong> We integrate with Kisi, Brivo, and CloudKey gate/lock systems. Select your provider from the dropdown.</p>
                <p><strong>Credentials:</strong> Enter your provider's API credentials (keys, org IDs, etc.) in the JSON field. These are securely stored and used to communicate with your gate system.</p>
                <p><strong>Webhook Setup:</strong> Configure your provider to send events to our webhook endpoint. Use the webhook secret to verify signatures.</p>
                <p><strong>How It Works:</strong> When a guest checks in, we send unlock commands to your gate system. Gate events (open/close) are logged for security audits.</p>
                <p className="text-status-info"><em>Note: This feature requires a compatible gate/lock provider. Contact us if you need help with integration.</em></p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center gap-2">
          <DoorOpen className="h-4 w-4 text-emerald-600" />
          <CardTitle>Provider setup</CardTitle>
          <Badge variant="outline">Per-campground</Badge>
        </CardHeader>
        <CardContent className="text-sm text-foreground space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Provider</Label>
              <Select
                value={selectedProvider}
                onValueChange={(value) => setSelectedProvider(value as typeof selectedProvider)}
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Display name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Front gate" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enabled">enabled</SelectItem>
                  <SelectItem value="disabled">disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
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
            <Label className="text-xs text-muted-foreground">Credentials (JSON)</Label>
            <Textarea
              className="font-mono text-xs"
              rows={10}
              value={credentialsText}
              onChange={(e) => setCredentialsText(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Store API keys, org/site ids, or other provider config. This is saved server-side.
            </p>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save provider"}
            </Button>
          </div>

          <div className="border-t pt-3 space-y-2">
            <div className="text-xs text-muted-foreground">
              Webhook endpoint: <code className="bg-muted px-1 py-0.5 rounded">/api/access/webhooks/{selectedProvider}</code>
            </div>
            <div className="text-xs text-muted-foreground">
              Pass <code className="bg-muted px-1 py-0.5 rounded">x-signature</code> with HMAC of raw body.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
