import fetch from "cross-fetch";

export type IntegrationType = "accounting" | "access_control" | "crm" | "export";

export interface IntegrationsClientOptions {
  baseUrl: string;
  apiKey?: string;
  token?: string;
}

export interface ConnectionPayload {
  campgroundId: string;
  organizationId?: string;
  type: IntegrationType;
  provider: string;
  status?: string;
  authType?: string;
  credentials?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  webhookSecret?: string;
}

export class IntegrationsClient {
  private base: string;
  private apiKey?: string;
  private token?: string;

  constructor(opts: IntegrationsClientOptions) {
    this.base = opts.baseUrl.replace(/\/$/, "");
    this.apiKey = opts.apiKey;
    this.token = opts.token;
  }

  private headers() {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) h["x-api-key"] = this.apiKey;
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    return h;
  }

  async upsertConnection(payload: ConnectionPayload) {
    const res = await fetch(`${this.base}/integrations/connections`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to upsert connection: ${res.statusText}`);
    return res.json();
  }

  async listConnections(campgroundId: string) {
    const res = await fetch(`${this.base}/integrations/connections?campgroundId=${campgroundId}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to list connections: ${res.statusText}`);
    return res.json();
  }

  async triggerSync(id: string, body: { direction?: string; scope?: string; note?: string } = {}) {
    const res = await fetch(`${this.base}/integrations/connections/${id}/sync`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed to queue sync: ${res.statusText}`);
    return res.json();
  }

  async listLogs(id: string, params: { limit?: number; cursor?: string } = {}) {
    const q = new URLSearchParams();
    if (params.limit) q.set("limit", String(params.limit));
    if (params.cursor) q.set("cursor", params.cursor);
    const res = await fetch(
      `${this.base}/integrations/connections/${id}/logs${q.toString() ? `?${q.toString()}` : ""}`,
      {
        headers: this.headers(),
      },
    );
    if (!res.ok) throw new Error(`Failed to list logs: ${res.statusText}`);
    return res.json();
  }

  async listWebhookEvents(id: string, params: { limit?: number; cursor?: string } = {}) {
    const q = new URLSearchParams();
    if (params.limit) q.set("limit", String(params.limit));
    if (params.cursor) q.set("cursor", params.cursor);
    const res = await fetch(
      `${this.base}/integrations/connections/${id}/webhooks${q.toString() ? `?${q.toString()}` : ""}`,
      {
        headers: this.headers(),
      },
    );
    if (!res.ok) throw new Error(`Failed to list webhooks: ${res.statusText}`);
    return res.json();
  }

  async queueExport(body: {
    type: "api" | "sftp";
    connectionId?: string;
    campgroundId?: string;
    resource?: string;
    location?: string;
  }) {
    const res = await fetch(`${this.base}/integrations/exports`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed to queue export: ${res.statusText}`);
    return res.json();
  }
}
