"use client";

import { useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "../../../../components/breadcrumbs";
import { Button } from "../../../../components/ui/button";
import { Card } from "../../../../components/ui/card";
import { Input } from "../../../../components/ui/input";
import { Textarea } from "../../../../components/ui/textarea";
import { Badge } from "../../../../components/ui/badge";
import { useToast } from "../../../../components/ui/use-toast";

type ApiClient = {
  id: string;
  name: string;
  clientId: string;
  scopes: string[];
  isActive: boolean;
  createdAt: string;
};

type WebhookEndpoint = {
  id: string;
  url: string;
  description?: string | null;
  eventTypes: string[];
  isActive: boolean;
};

type WebhookDelivery = {
  id: string;
  eventType: string;
  status: string;
  responseStatus?: number;
  createdAt: string;
  errorMessage?: string | null;
  webhookEndpoint: { url: string };
};

const apiBase = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api").replace(/\/$/, "");
const sandboxCampgroundId = process.env.NEXT_PUBLIC_SANDBOX_CAMPGROUND || "sandbox-camp";
const staffToken = process.env.NEXT_PUBLIC_STAFF_TOKEN;
const adminHeaders = staffToken ? { Authorization: `Bearer ${staffToken}` } : {};
const defaultScopes = ["reservations:read", "reservations:write", "guests:read", "guests:write", "sites:read", "sites:write", "webhooks:read", "webhooks:write"];
const defaultEvents = ["reservation.created", "payment.created", "site.updated"];

export default function DeveloperSettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ApiClient[]>([]);
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [clientName, setClientName] = useState("Sandbox partner");
  const [webhookUrl, setWebhookUrl] = useState("https://webhook.site/example");
  const [webhookEvents, setWebhookEvents] = useState(defaultEvents.join(","));
  const [lastSecret, setLastSecret] = useState<string | null>(null);

  const headers = useMemo(() => {
    const base: Record<string, string> = { "content-type": "application/json" };
    if (adminHeaders?.Authorization) {
      base.Authorization = adminHeaders.Authorization;
    }
    return base;
  }, [adminHeaders]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const [clientsRes, endpointsRes, deliveriesRes] = await Promise.all([
          fetch(`${apiBase}/developer/clients?campgroundId=${sandboxCampgroundId}`, { headers }),
          fetch(`${apiBase}/developer/webhooks/endpoints?campgroundId=${sandboxCampgroundId}`, { headers }),
          fetch(`${apiBase}/developer/webhooks/deliveries?campgroundId=${sandboxCampgroundId}&limit=25`, { headers })
        ]);
        if (clientsRes.ok) {
          const json = await clientsRes.json();
          if (!cancelled) setClients(json);
        }
        if (endpointsRes.ok) {
          const json = await endpointsRes.json();
          if (!cancelled) setEndpoints(json);
        }
        if (deliveriesRes.ok) {
          const json = await deliveriesRes.json();
          if (!cancelled) setDeliveries(json);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [headers]);

  const requireToken = () => {
    if (!staffToken) {
      toast({ title: "Add a staff token", description: "Set NEXT_PUBLIC_STAFF_TOKEN to call the admin endpoints locally." });
      return false;
    }
    return true;
  };

  async function createClient() {
    if (!requireToken()) return;
    const res = await fetch(`${apiBase}/developer/clients`, {
      method: "POST",
      headers,
      body: JSON.stringify({ campgroundId: sandboxCampgroundId, name: clientName || "Sandbox partner", scopes: defaultScopes })
    });
    if (!res.ok) {
      toast({ title: "Client create failed", description: `Status ${res.status}` });
      return;
    }
    const json = await res.json();
    setLastSecret(json.clientSecret);
    setClients(await (await fetch(`${apiBase}/developer/clients?campgroundId=${sandboxCampgroundId}`, { headers })).json());
    toast({ title: "Client created", description: "Secret shown below once." });
  }

  async function rotateSecret(id: string) {
    if (!requireToken()) return;
    const res = await fetch(`${apiBase}/developer/clients/${id}/rotate`, { method: "POST", headers });
    if (res.ok) {
      const json = await res.json();
      setLastSecret(json.clientSecret);
      toast({ title: "Secret rotated", description: "Copy the new secret now." });
    } else {
      toast({ title: "Rotate failed", description: `Status ${res.status}` });
    }
  }

  async function toggleClient(id: string, isActive: boolean) {
    if (!requireToken()) return;
    await fetch(`${apiBase}/developer/clients/${id}/toggle`, { method: "PATCH", headers, body: JSON.stringify({ isActive }) });
    setClients(await (await fetch(`${apiBase}/developer/clients?campgroundId=${sandboxCampgroundId}`, { headers })).json());
  }

  async function createWebhook() {
    if (!requireToken()) return;
    const events = webhookEvents.split(",").map(e => e.trim()).filter(Boolean);
    const res = await fetch(`${apiBase}/developer/webhooks/endpoints`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        campgroundId: sandboxCampgroundId,
        url: webhookUrl,
        description: "Sandbox webhook",
        eventTypes: events
      })
    });
    if (!res.ok) {
      toast({ title: "Webhook create failed", description: `Status ${res.status}` });
      return;
    }
    setEndpoints(await (await fetch(`${apiBase}/developer/webhooks/endpoints?campgroundId=${sandboxCampgroundId}`, { headers })).json());
    toast({ title: "Webhook added", description: "A signing secret is stored server-side." });
  }

  async function toggleWebhook(id: string, isActive: boolean) {
    if (!requireToken()) return;
    await fetch(`${apiBase}/developer/webhooks/endpoints/${id}/toggle`, { method: "PATCH", headers, body: JSON.stringify({ isActive }) });
    setEndpoints(await (await fetch(`${apiBase}/developer/webhooks/endpoints?campgroundId=${sandboxCampgroundId}`, { headers })).json());
  }

  async function replayDelivery(id: string) {
    if (!requireToken()) return;
    const res = await fetch(`${apiBase}/developer/webhooks/deliveries/${id}/replay`, { method: "POST", headers });
    toast({ title: res.ok ? "Replay triggered" : "Replay failed", description: res.ok ? "Check the delivery log below." : `Status ${res.status}` });
    setDeliveries(await (await fetch(`${apiBase}/developer/webhooks/deliveries?campgroundId=${sandboxCampgroundId}&limit=25`, { headers })).json());
  }

  return (
    <div className="space-y-4">
        <Breadcrumbs items={[{ label: "Settings" }, { label: "Developer ecosystem" }]} />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Developer ecosystem</h1>
            <p className="text-sm text-slate-600">OAuth2 clients, signed webhooks, and sandbox tools.</p>
          </div>
          {!staffToken && (
            <Badge variant="secondary">Set NEXT_PUBLIC_STAFF_TOKEN for admin calls</Badge>
          )}
        </div>

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">API credentials</div>
              <div className="text-sm text-slate-600">Scoped per campground; uses OAuth2 client_credentials.</div>
            </div>
            <Button onClick={createClient}>Create client</Button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs uppercase text-slate-500">Client name</label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
              <label className="text-xs uppercase text-slate-500">Scopes</label>
              <Textarea value={defaultScopes.join(" ")} readOnly />
              <div className="text-xs text-slate-500">Campground: {sandboxCampgroundId}</div>
            </div>
            <div className="rounded-lg border border-dashed border-slate-200 p-3 bg-slate-50">
              <div className="text-xs uppercase text-slate-500 mb-1">Last generated secret</div>
              <div className="font-mono text-sm break-all">{lastSecret || "— generate or rotate to view once"}</div>
            </div>
          </div>
          <div className="space-y-2">
            {clients.map((client) => (
              <div key={client.id} className="rounded-lg border border-slate-200 p-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">{client.name}</div>
                  <div className="text-xs text-slate-600">client_id: {client.clientId}</div>
                  <div className="text-xs text-slate-500">Scopes: {client.scopes.join(", ")}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={client.isActive ? "default" : "secondary"}>{client.isActive ? "Active" : "Disabled"}</Badge>
                  <Button size="sm" variant="outline" onClick={() => rotateSecret(client.id)}>Rotate secret</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleClient(client.id, !client.isActive)}>
                    {client.isActive ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>
            ))}
            {!clients.length && !loading && <div className="text-sm text-slate-600">No clients yet.</div>}
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">Webhook endpoints</div>
              <div className="text-sm text-slate-600">Signed with HMAC; replay and disable per endpoint.</div>
            </div>
            <Button variant="outline" onClick={createWebhook}>Add endpoint</Button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs uppercase text-slate-500">Destination URL</label>
              <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
              <label className="text-xs uppercase text-slate-500">Event types (comma separated)</label>
              <Input value={webhookEvents} onChange={(e) => setWebhookEvents(e.target.value)} />
              <p className="text-xs text-slate-500">Default: reservation.created, payment.created, site.updated</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
              <div className="text-xs uppercase text-slate-500 mb-1">Signature header</div>
              <div className="font-mono text-xs break-all">x-campreserv-signature: t=timestamp,v1=hmac_sha256(timestamp.body)</div>
              <div className="text-xs text-slate-500 mt-2">Secrets are stored server-side; rotate by disabling and re-creating.</div>
            </div>
          </div>
          <div className="space-y-2">
            {endpoints.map((ep) => (
              <div key={ep.id} className="rounded-lg border border-slate-200 p-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">{ep.url}</div>
                  <div className="text-xs text-slate-500">Events: {ep.eventTypes.join(", ")}</div>
                  {ep.description && <div className="text-xs text-slate-500">{ep.description}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={ep.isActive ? "default" : "secondary"}>{ep.isActive ? "Active" : "Disabled"}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => toggleWebhook(ep.id, !ep.isActive)}>
                    {ep.isActive ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>
            ))}
            {!endpoints.length && !loading && <div className="text-sm text-slate-600">No webhook endpoints yet.</div>}
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">Delivery log</div>
              <div className="text-sm text-slate-600">Replay failed events from the sandbox.</div>
            </div>
          </div>
          <div className="space-y-2">
            {deliveries.map((d) => (
              <div key={d.id} className="rounded-lg border border-slate-200 p-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">{d.eventType}</div>
                  <div className="text-xs text-slate-500">Target: {d.webhookEndpoint.url}</div>
                  <div className="text-xs text-slate-500">
                    Status: {d.status} {d.responseStatus ? `(${d.responseStatus})` : ""} • {new Date(d.createdAt).toLocaleString()}
                  </div>
                  {d.errorMessage && <div className="text-xs text-rose-600">Error: {d.errorMessage}</div>}
                </div>
                <Button size="sm" variant="outline" onClick={() => replayDelivery(d.id)}>Replay</Button>
              </div>
            ))}
            {!deliveries.length && !loading && <div className="text-sm text-slate-600">No deliveries yet.</div>}
          </div>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="font-semibold text-slate-900">Extensibility hook</div>
          <div className="text-sm text-slate-600">Embed partner UI blocks inside admin.</div>
          <div className="rounded-lg border border-dashed border-slate-200 p-4 bg-slate-50">
            <div data-developer-hook="sandbox-block" className="text-sm text-slate-800">
              This surface is reserved for partner embeds. Drop in an iframe or React component that reads this element by
              data-developer-hook to inject custom UI.
            </div>
          </div>
        </Card>
      </div>
  );
}

