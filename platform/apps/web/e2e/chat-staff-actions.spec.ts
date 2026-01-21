import { test, expect, type Page } from "@playwright/test";

const buildSseBody = (events: Array<Record<string, unknown>>) =>
  events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const openStaffChat = async (page: Page) => {
  await page.goto("/analytics");
  await page.waitForLoadState("domcontentloaded");

  const launcher = page.getByLabel("Open Keepr Ops chat");
  await expect(launcher).toBeVisible({ timeout: 15000 });
  await launcher.click();

  const list = page.getByTestId("chat-message-list");
  await expect(list).toBeVisible();
};

test.describe("Staff chat actions", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("campreserv:selectedCampground", "mock-camp");
      window.localStorage.setItem("campreserv:authToken", "test-token");
    });
  });

  test("approves a staff action from the action card", async ({ page }) => {
    let actionPayload: Record<string, unknown> | null = null;

    await page.route("**/api/chat/campgrounds/mock-camp/action", async (route) => {
      const payload = route.request().postDataJSON();
      if (isRecord(payload)) {
        actionPayload = payload;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "Hold confirmed." }),
      });
    });

    await page.route("**/api/chat/stream", async (route) => {
      const events = [
        {
          type: "data",
          data: {
            conversationId: "conv-1",
            messageId: "assistant_1",
            content: "Please confirm the hold.",
            actionRequired: {
              type: "confirmation",
              actionId: "action-1",
              title: "Confirm hold",
              description: "Hold site B2 for the requested dates.",
              summary: "Hold site B2 from 2025-01-01 to 2025-01-03.",
              options: [
                { id: "confirm", label: "Confirm" },
                { id: "cancel", label: "Cancel", variant: "outline" },
              ],
            },
          },
        },
        { type: "done" },
      ];
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: buildSseBody(events),
      });
    });

    await openStaffChat(page);
    const input = page.getByPlaceholder("Ask about arrivals, occupancy, tasks...");
    await input.fill("Place a hold on B2.");
    await input.press("Enter");

    await expect(page.getByText("Confirm hold")).toBeVisible();
    await page.getByRole("button", { name: "Confirm" }).click();

    await expect(page.getByText("Hold confirmed.")).toBeVisible();

    expect(actionPayload).toEqual(
      expect.objectContaining({
        actionId: "action-1",
        selectedOption: "confirm",
      }),
    );
  });
});
