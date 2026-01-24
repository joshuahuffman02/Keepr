import { describe, expect, it } from "vitest";
import { DeveloperApiClient } from ".";

describe("DeveloperApiClient entrypoint (mock mode)", () => {
  it("creates and reads a reservation via createMock()", async () => {
    const mock = DeveloperApiClient.createMock();

    const created = await mock.createReservation({
      siteId: "site-123",
      guestId: "guest-123",
      arrivalDate: "2024-09-01",
      departureDate: "2024-09-03",
      adults: 2,
    });

    const list = await mock.listReservations();

    expect(created.id).toBeDefined();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: created.id,
      siteId: "site-123",
      guestId: "guest-123",
    });
  });
});
