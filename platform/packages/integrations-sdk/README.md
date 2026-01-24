# @keepr/integrations-sdk

Lightweight TypeScript client for Keepr integrations endpoints.

## Install

```bash
pnpm add @keepr/integrations-sdk
```

## Usage

```ts
import { IntegrationsClient } from "@keepr/integrations-sdk";

const client = new IntegrationsClient({
  baseUrl: "https://api.example.com/api",
  token: "YOUR_JWT_OR_TOKEN",
});

// Upsert a connection (sandbox QBO)
await client.upsertConnection({
  campgroundId: "cg_123",
  type: "accounting",
  provider: "qbo",
  credentials: { accessToken: "sandbox-token" },
  settings: { realmId: "sandbox-realm-id" },
});

// List connections
const connections = await client.listConnections("cg_123");

// Queue a sync
await client.triggerSync(connections[0].id, { note: "Manual sync" });

// View logs and webhooks
await client.listLogs(connections[0].id);
await client.listWebhookEvents(connections[0].id);

// Queue an export job
await client.queueExport({ type: "api", connectionId: connections[0].id, resource: "ledger" });
```

## Notes

- Uses cross-fetch; set `token` or `apiKey` for auth headers.
- Keep sandbox credentials only; production provider creds require approval.
