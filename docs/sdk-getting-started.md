# SDK getting started

Short setup guide for the public SDKs: the application SDK (`@campreserv/sdk`) and the integrations SDK (`@campreserv/integrations-sdk`).

## Install

```bash
pnpm add @campreserv/sdk @campreserv/integrations-sdk
```

## App SDK (`@campreserv/sdk`)

- Auth: OAuth2 client-credentials against `POST /api/oauth/token` using your `client_id`/`client_secret` and scopes like `reservations:read reservations:write guests:write sites:read`.
- Base URL: defaults to `http://localhost:4000/api`; override via `baseUrl`.

```ts
import { DeveloperApiClient } from "@campreserv/sdk";

const client = new DeveloperApiClient({
  baseUrl: "https://api.campreserv.com/api",
  clientId: process.env.CAMPRESERV_CLIENT_ID!,
  clientSecret: process.env.CAMPRESERV_CLIENT_SECRET!,
  campgroundId: "camp-123",
  scopes: ["reservations:read", "reservations:write", "guests:write", "sites:read"],
});

// Reservations CRUD
const createdRes = await client.createReservation({
  siteId: "site-1",
  guestId: "guest-1",
  arrivalDate: "2024-09-01",
  departureDate: "2024-09-03",
  adults: 2,
});
const reservations = await client.listReservations();
await client.updateReservation(createdRes.id!, { notes: "Late arrival" });
await client.deleteReservation(createdRes.id!);

// Guests and sites follow the same pattern
await client.createGuest({
  primaryFirstName: "Pat",
  primaryLastName: "Jones",
  email: "pat@example.com",
});
await client.createSite({ name: "Creekside", siteNumber: "A1", siteType: "rv", maxOccupancy: 6 });
```

### Mock mode (no network)

For demos or CI, use the in-memory mock:

```ts
const mock = DeveloperApiClient.createMock();
await mock.createReservation({
  siteId: "1",
  guestId: "g1",
  arrivalDate: "2024-08-01",
  departureDate: "2024-08-02",
  adults: 2,
});
const inMemory = await mock.listReservations(); // stays in-memory only
```

## Integrations SDK (`@campreserv/integrations-sdk`)

- Auth: supply either `token` (Bearer) or `apiKey` header.
- Base URL: the API root that serves `/integrations/*` routes.

```ts
import { IntegrationsClient } from "@campreserv/integrations-sdk";

const integrations = new IntegrationsClient({
  baseUrl: "https://api.campreserv.com/api",
  token: process.env.CAMPRESERV_INTEGRATIONS_TOKEN,
});

const connection = await integrations.upsertConnection({
  campgroundId: "camp-123",
  type: "accounting",
  provider: "qbo",
  credentials: { accessToken: "sandbox-token" },
  settings: { realmId: "sandbox-realm-id" },
});

const connections = await integrations.listConnections("camp-123");
await integrations.triggerSync(connection.id, { note: "Manual sync" });
await integrations.queueExport({ type: "api", connectionId: connection.id, resource: "ledger" });
```

### Integrations mock/stub pattern (no external calls)

In tests/CI, stub `cross-fetch` to avoid real network calls:

```ts
import { vi } from "vitest";
import { IntegrationsClient } from "@campreserv/integrations-sdk";

const fetchMock = vi.fn();
vi.mock("cross-fetch", () => ({ default: fetchMock }));

fetchMock.mockResolvedValue(
  new Response(JSON.stringify([{ id: "conn-1" }]), {
    status: 200,
    headers: { "content-type": "application/json" },
  }),
);

const client = new IntegrationsClient({
  baseUrl: "https://api.example.com/api",
  token: "fake-token",
});
await client.listConnections("camp-123");
```
