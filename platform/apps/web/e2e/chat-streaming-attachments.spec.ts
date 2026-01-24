import { test, expect, type Page } from "@playwright/test";

const buildSseBody = (events: Array<Record<string, unknown>>) =>
  events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");

const openStaffChat = async (page: Page) => {
  await page.goto("/analytics");
  await page.waitForLoadState("domcontentloaded");

  const launcher = page.getByLabel("Open Keepr Ops chat");
  await expect(launcher).toBeVisible({ timeout: 15000 });
  await launcher.click();

  const list = page.getByTestId("chat-message-list");
  await expect(list).toBeVisible();

  return { list };
};

test.describe("Chat streaming + attachments", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("campreserv:selectedCampground", "mock-camp");
      window.localStorage.setItem("campreserv:authToken", "test-token");
    });
  });

  test("streams assistant response via SSE", async ({ page }) => {
    await page.route("**/api/chat/stream", async (route) => {
      const events = [
        {
          type: "data",
          data: {
            conversationId: "conv-1",
            messageId: "assistant_1",
            content: "Hello there",
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
    await input.fill("Ping");
    await expect(input).toHaveValue("Ping");
    await input.press("Enter");

    await expect(page.getByText("Hello there")).toBeVisible();
  });

  test("uploads attachments and includes them in the chat message", async ({ page }) => {
    await page.route("**/api/chat/campgrounds/mock-camp/attachments/sign", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          uploadUrl: "/uploads/attachment-1",
          storageKey: "att-1",
          publicUrl: "https://files.test/att-1",
          downloadUrl: "https://files.test/att-1?dl=1",
        }),
      });
    });
    await page.route("**/uploads/attachment-1", async (route) => {
      await route.fulfill({ status: 200, body: "" });
    });
    await page.route("**/api/chat/stream", async (route) => {
      const events = [{ type: "text", value: "Got it." }, { type: "done" }];
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: buildSseBody(events),
      });
    });

    await openStaffChat(page);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "site-photo.png",
      mimeType: "image/png",
      buffer: Buffer.from("attachment"),
    });

    await expect(page.getByText("Ready to send")).toBeVisible();

    const input = page.getByPlaceholder("Ask about arrivals, occupancy, tasks...");
    await input.fill("Here is the photo.");
    await input.press("Enter");

    await expect(page.getByText("site-photo.png")).toBeVisible();
  });
});
