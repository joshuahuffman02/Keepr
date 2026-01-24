# Keepr SDK (Developer API)

TypeScript client for the public Keepr API with OAuth2 client-credentials auth.

## Install

```bash
pnpm add @keepr/sdk
```

## Configure

```ts
import { DeveloperApiClient } from "@keepr/sdk";

const client = new DeveloperApiClient({
  baseUrl: "http://localhost:4000/api", // or your deployed API base
  clientId: process.env.KEEPR_CLIENT_ID!,
  clientSecret: process.env.KEEPR_CLIENT_SECRET!,
  campgroundId: "your-camp-id",
  scopes: ["reservations:read", "reservations:write"],
});
```

## Reservations (public CRUD)

```ts
// Create
const reservation = await client.createReservation({
  siteId: "site-123",
  guestId: "guest-123",
  arrivalDate: "2024-08-01",
  departureDate: "2024-08-05",
  adults: 2,
});

// Update
await client.updateReservation(reservation.id!, { notes: "Late arrival" });

// List
const reservations = await client.listReservations();

// Delete
await client.deleteReservation(reservation.id!);
```

## Mock usage (no real creds required)

For tests or local demos without hitting the API, use the in-memory mock:

```ts
const mock = DeveloperApiClient.createMock();
await mock.createReservation({
  siteId: "1",
  guestId: "g1",
  arrivalDate: "2024-08-01",
  departureDate: "2024-08-03",
  adults: 2,
});
const all = await mock.listReservations();
```

### Mocked OAuth token flow (tests)

```ts
import { DeveloperApiClient } from "@keepr/sdk";

// Stub fetch to return a token, then CRUD responses.
global.fetch = vi
  .fn()
  // token
  .mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        access_token: "mock-access",
        refresh_token: "mock-refresh",
        expires_in: 3600,
        scope: "reservations:read reservations:write",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );
// create -> update -> delete -> list ...

const client = new DeveloperApiClient({
  baseUrl: "https://api.example.com",
  clientId: "client-id",
  clientSecret: "client-secret",
  campgroundId: "camp-1",
  scopes: ["reservations:read", "reservations:write"],
});

await client.createReservation({
  siteId: "1",
  guestId: "g1",
  arrivalDate: "2024-08-01",
  departureDate: "2024-08-03",
  adults: 2,
});
await client.listReservations();
```

## Testing

```bash
pnpm test
```
