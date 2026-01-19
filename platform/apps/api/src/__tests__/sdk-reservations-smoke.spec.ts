import { Response } from "node-fetch";
import { DeveloperApiClient, type ReservationPayload, type Scope } from "@keepr/sdk";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("SDK OAuth + reservations CRUD (mocked)", () => {
  const baseUrl = "https://api.example.com";
  const scopes: Scope[] = ["reservations:read", "reservations:write"];
  const config = {
    baseUrl,
    clientId: "client-id",
    clientSecret: "client-secret",
    campgroundId: "camp-1",
    scopes
  };

  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    Object.defineProperty(globalThis, "fetch", { value: fetchMock, configurable: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("authenticates via client credentials and performs reservations CRUD", async () => {
    const payload: ReservationPayload = {
      siteId: "site-1",
      guestId: "guest-1",
      arrivalDate: "2024-06-01",
      departureDate: "2024-06-05",
      adults: 2
    };

    fetchMock
      // OAuth token
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: "mock-access",
          refresh_token: "mock-refresh",
          expires_in: 3600,
          scope: "reservations:read reservations:write"
        })
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
      1,
      `${baseUrl}/developer/oauth/token`,
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: "client-id",
          client_secret: "client-secret",
          scope: "reservations:read reservations:write"
        })
      })
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${baseUrl}/developer/reservations`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer mock-access",
          "content-type": "application/json"
        }),
        body: JSON.stringify(payload)
      })
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `${baseUrl}/developer/reservations/res-1`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({
          Authorization: "Bearer mock-access",
          "content-type": "application/json"
        }),
        body: JSON.stringify({ notes: "updated" })
      })
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      `${baseUrl}/developer/reservations/res-1`,
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({
          Authorization: "Bearer mock-access"
        })
      })
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      `${baseUrl}/developer/reservations`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer mock-access"
        })
      })
    );
  });
});
