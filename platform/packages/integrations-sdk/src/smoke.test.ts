import { afterEach, describe, expect, it, vi } from "vitest";
import { IntegrationsClient } from ".";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("cross-fetch", () => ({ default: fetchMock }));

describe("IntegrationsClient entrypoint (stubbed fetch)", () => {
  afterEach(() => {
    fetchMock.mockReset();
  });

  it("performs a minimal connection flow without real network", async () => {
    const client = new IntegrationsClient({
      baseUrl: "https://api.example.com/api",
      token: "fake-token",
    });

    const connection = {
      id: "conn-1",
      campgroundId: "camp-123",
      type: "accounting",
      provider: "qbo",
    };
    const logPage = [{ id: "log-1" }];
    const webhookPage = [{ id: "webhook-1" }];

    fetchMock
      // upsert connection
      .mockResolvedValueOnce(
        new Response(JSON.stringify(connection), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      // list connections
      .mockResolvedValueOnce(
        new Response(JSON.stringify([connection]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      // trigger sync
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "queued" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      // list logs
      .mockResolvedValueOnce(
        new Response(JSON.stringify(logPage), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      // list webhook events
      .mockResolvedValueOnce(
        new Response(JSON.stringify(webhookPage), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      // queue export
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "export-1" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    const created = await client.upsertConnection({
      campgroundId: "camp-123",
      type: "accounting",
      provider: "qbo",
      credentials: { accessToken: "sandbox-token" },
      settings: { realmId: "sandbox-realm-id" },
    });

    const list = await client.listConnections("camp-123");
    const sync = await client.triggerSync(created.id, { note: "manual" });
    const logs = await client.listLogs(created.id);
    const webhooks = await client.listWebhookEvents(created.id);
    const exportJob = await client.queueExport({
      type: "api",
      connectionId: created.id,
      resource: "ledger",
    });

    expect(created).toMatchObject(connection);
    expect(list).toHaveLength(1);
    expect(sync).toMatchObject({ status: "queued" });
    expect(logs).toEqual(logPage);
    expect(webhooks).toEqual(webhookPage);
    expect(exportJob).toMatchObject({ id: "export-1" });

    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});
