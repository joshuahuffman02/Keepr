import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { DeveloperApiClient } from "./client";
import type { ReservationPayload, Scope, SdkConfig } from "./types";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("DeveloperApiClient (mocked)", () => {
  const baseUrl = "https://api.example.com";
  const scopes: Scope[] = ["reservations:read", "reservations:write"];
  const config: SdkConfig = {
    baseUrl,
    clientId: "client-id",
    clientSecret: "client-secret",
    campgroundId: "camp-1",
    scopes,
  };

  let fetchMock = vi.fn<typeof fetch>();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
    fetchMock = vi.fn<typeof fetch>();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  test("authenticates with client credentials and sends bearer token", async () => {
    fetchMock
      // OAuth token
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: "mock-access",
          refresh_token: "mock-refresh",
          expires_in: 3600,
          scope: "reservations:read reservations:write",
        }),
      )
      // list reservations
      .mockResolvedValueOnce(jsonResponse([{ id: "res-1" }]));

    const client = new DeveloperApiClient(config);
    const reservations = await client.listReservations();

    expect(reservations).toEqual([{ id: "res-1" }]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${baseUrl}/oauth/token`,
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: "client-id",
          client_secret: "client-secret",
          scope: "reservations:read reservations:write",
        }),
      }),
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${baseUrl}/public/reservations`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer mock-access",
        }),
      }),
    );
  });

  test("performs reservation CRUD against public endpoints", async () => {
    const payload: ReservationPayload = {
      siteId: "site-1",
      guestId: "guest-1",
      arrivalDate: "2024-06-01",
      departureDate: "2024-06-05",
      adults: 2,
    };

    fetchMock
      // OAuth token
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: "mock-access",
          refresh_token: "mock-refresh",
          expires_in: 3600,
          scope: "reservations:read reservations:write",
        }),
      )
      // create
      .mockResolvedValueOnce(jsonResponse({ ...payload, id: "res-1" }))
      // update
      .mockResolvedValueOnce(jsonResponse({ ...payload, id: "res-1", notes: "updated" }))
      // delete
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      // list
      .mockResolvedValueOnce(jsonResponse([{ id: "res-1" }]));

    const client = new DeveloperApiClient(config);

    const created = await client.createReservation(payload);
    const updated = await client.updateReservation("res-1", { notes: "updated" });
    const deleted = await client.deleteReservation("res-1");
    const listed = await client.listReservations();

    expect(created).toMatchObject({ id: "res-1", siteId: "site-1" });
    expect(updated).toMatchObject({ id: "res-1", notes: "updated" });
    expect(deleted).toEqual({ success: true });
    expect(listed).toEqual([{ id: "res-1" }]);

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${baseUrl}/public/reservations`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer mock-access",
          "content-type": "application/json",
        }),
        body: JSON.stringify(payload),
      }),
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `${baseUrl}/public/reservations/res-1`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({
          Authorization: "Bearer mock-access",
          "content-type": "application/json",
        }),
        body: JSON.stringify({ notes: "updated" }),
      }),
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      `${baseUrl}/public/reservations/res-1`,
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({
          Authorization: "Bearer mock-access",
        }),
      }),
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      `${baseUrl}/public/reservations`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer mock-access",
        }),
      }),
    );
  });
});
