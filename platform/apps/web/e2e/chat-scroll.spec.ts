import { test, expect, type Page } from "@playwright/test";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const buildSseBody = (events: Array<Record<string, unknown>>) =>
  events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");

const buildLongResponse = () =>
  Array.from({ length: 60 }, (_, index) => `KPI line ${index + 1}: placeholder text.`).join("\n");

const buildDailyTrend = () =>
  Array.from({ length: 7 }, (_, index) => ({
    date: `2025-01-0${index + 1}`,
    percentage: 72 + index,
  }));

const openChat = async (page: Page) => {
  await page.goto("/analytics");
  await page.waitForLoadState("domcontentloaded");

  const launcher = page.getByLabel("Open Keepr Ops chat");
  await expect(launcher).toBeVisible({ timeout: 15000 });
  await launcher.click();

  const list = page.getByTestId("chat-message-list");
  await expect(list).toBeVisible();

  return { list };
};

test.describe("Chat widget scroll", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("campreserv:selectedCampground", "mock-camp");
      window.localStorage.setItem("campreserv:authToken", "test-token");
    });
  });

  test("scrolls inside chat list and exposes jump-to-latest", async ({ page }) => {
    const { list } = await openChat(page);

    await list.evaluate((node) => {
      const filler = document.createElement("div");
      filler.setAttribute("data-testid", "chat-scroll-filler");
      filler.style.height = "2000px";
      filler.style.borderTop = "1px solid transparent";
      const bottom = node.lastElementChild;
      if (bottom) {
        node.insertBefore(filler, bottom);
      } else {
        node.appendChild(filler);
      }
    });

    const canScroll = await list.evaluate((node) => node.scrollHeight > node.clientHeight);
    expect(canScroll).toBeTruthy();

    await list.evaluate((node) => {
      node.scrollTop = 0;
      node.dispatchEvent(new Event("scroll"));
    });
    const initialScrollTop = await list.evaluate((node) => node.scrollTop);
    await list.evaluate((node) => {
      node.scrollTop = 200;
      node.dispatchEvent(new Event("scroll"));
    });
    const afterScrollTop = await list.evaluate((node) => node.scrollTop);
    expect(afterScrollTop).toBeGreaterThan(initialScrollTop);

    const jumpButton = page.getByTestId("chat-jump-to-latest");
    await expect(jumpButton).toBeVisible();
    await jumpButton.click();

    await expect.poll(() => list.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  });

  test("keeps page scroll locked while wheeling inside chat list", async ({ page }) => {
    const { list } = await openChat(page);

    await page.evaluate(() => {
      document.body.style.height = "3000px";
      document.documentElement.style.height = "3000px";
      window.scrollTo(0, 0);
    });

    await list.evaluate((node) => {
      const filler = document.createElement("div");
      filler.setAttribute("data-testid", "chat-scroll-filler");
      filler.style.height = "2000px";
      filler.style.borderTop = "1px solid transparent";
      const bottom = node.lastElementChild;
      if (bottom) {
        node.insertBefore(filler, bottom);
      } else {
        node.appendChild(filler);
      }
    });

    await expect
      .poll(() => list.evaluate((node) => node.scrollHeight > node.clientHeight))
      .toBeTruthy();

    const listBox = await list.boundingBox();
    expect(listBox).not.toBeNull();
    if (!listBox) return;

    await page.mouse.move(listBox.x + listBox.width / 2, listBox.y + listBox.height / 2);

    await list.evaluate((node) => {
      node.scrollTop = 0;
    });

    const pageScrollBefore = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 500);

    const pageScrollAfter = await page.evaluate(() => window.scrollY);

    expect(pageScrollAfter).toBe(pageScrollBefore);
  });

  test("keeps page scroll locked while wheeling inside long message body", async ({ page }) => {
    const longResponse = buildLongResponse();

    await page.route("**/api/chat/stream", async (route) => {
      const events = [
        {
          type: "data",
          data: {
            conversationId: "conv-1",
            messageId: "assistant_1",
            content: longResponse,
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

    await openChat(page);
    const input = page.getByPlaceholder("Ask about arrivals, occupancy, tasks...");
    await input.fill("Send the long KPI snapshot.");
    await input.press("Enter");

    const longBody = page.getByTestId("chat-long-message-body").first();
    await expect(longBody).toBeVisible();
    await expect
      .poll(() => longBody.evaluate((node) => node.scrollHeight > node.clientHeight))
      .toBeTruthy();

    await page.evaluate(() => {
      document.body.style.height = "3000px";
      document.documentElement.style.height = "3000px";
      window.scrollTo(0, 0);
    });

    const pageScrollBefore = await page.evaluate(() => window.scrollY);
    await longBody.evaluate((node) => {
      node.dispatchEvent(new WheelEvent("wheel", { deltaY: 400, bubbles: true, cancelable: true }));
    });
    const pageScrollAfter = await page.evaluate(() => window.scrollY);
    expect(pageScrollAfter).toBe(pageScrollBefore);

    const bodyScrollTop = await longBody.evaluate((node) => node.scrollTop);
    expect(bodyScrollTop).toBeGreaterThan(0);
  });

  test("renders KPI snapshot and auto-opens report artifacts", async ({ page }) => {
    const dailyBreakdown = buildDailyTrend();

    await page.route("**/api/chat/stream", async (route) => {
      const events = [
        {
          type: "data",
          data: {
            conversationId: "conv-1",
            messageId: "assistant_1",
            content: "Here is the KPI snapshot for today.",
            toolResults: [
              {
                toolCallId: "tool-occupancy",
                result: {
                  count: 5,
                  arrivals: [{ id: "r1" }, { id: "r2" }],
                  occupancy: {
                    totalSites: 120,
                    averageOccupancy: "79%",
                    dailyBreakdown,
                  },
                  jsonRender: {
                    title: "Occupancy Report",
                    summary: "Average occupancy 79%",
                    tree: {
                      root: "root",
                      elements: {
                        root: { type: "Stack", props: { gap: 2 }, children: [] },
                      },
                    },
                    data: { dailyBreakdown },
                  },
                },
              },
            ],
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

    await openChat(page);
    const input = page.getByPlaceholder("Ask about arrivals, occupancy, tasks...");
    await input.fill("Show the KPI snapshot.");
    await input.press("Enter");

    const snapshot = page.getByTestId("chat-kpi-snapshot");
    await expect(snapshot).toBeVisible();
    const snapshotText = await snapshot.innerText();
    expect(snapshotText).toContain("Arrivals");
    expect(snapshotText).toContain("Avg occupancy");
    expect(snapshotText).toContain("7-day trend");

    await expect(page.getByRole("button", { name: "Open report" })).toBeVisible();
    const artifactsPanel = page.getByText("Artifacts").locator("..").locator("..");
    await expect(artifactsPanel).toBeVisible();
    await expect(artifactsPanel.getByText("Occupancy Report").first()).toBeVisible();

    await page.getByLabel("Close artifacts panel").click();
    await expect(page.getByText("Artifacts")).toHaveCount(0);

    await page.getByRole("button", { name: "Open report" }).click();
    await expect(page.getByText("Artifacts")).toBeVisible();
  });

  test("shows new-message marker when scrolled up", async ({ page }) => {
    const longResponse = buildLongResponse();
    let responseReady = false;
    let respondWithMessage: () => Promise<void> = async () => {
      throw new Error("Response handler not initialized.");
    };

    await page.route("**/api/chat/stream", async (route) => {
      const payload = route.request().postDataJSON();
      const body = isRecord(payload) ? payload : {};
      const visibility = body.visibility === "internal" ? "internal" : "public";
      respondWithMessage = async () => {
        const events = [
          {
            type: "data",
            data: {
              conversationId: "conv-1",
              messageId: "assistant_1",
              content: longResponse,
              visibility,
            },
          },
          { type: "done" },
        ];
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
          body: buildSseBody(events),
        });
      };
      responseReady = true;
    });

    const { list } = await openChat(page);
    const input = page.getByPlaceholder("Ask about arrivals, occupancy, tasks...");

    await list.evaluate((node) => {
      const filler = document.createElement("div");
      filler.setAttribute("data-testid", "chat-scroll-filler");
      filler.style.height = "1600px";
      filler.style.borderTop = "1px solid transparent";
      const bottom = node.lastElementChild;
      if (bottom) {
        node.insertBefore(filler, bottom);
      } else {
        node.appendChild(filler);
      }
    });

    await input.fill("Send the long KPI snapshot.");
    await input.press("Enter");

    await expect
      .poll(() => list.evaluate((node) => node.scrollHeight > node.clientHeight))
      .toBeTruthy();

    await list.evaluate((node) => {
      node.scrollTop = 0;
      node.dispatchEvent(new Event("scroll"));
    });

    await expect.poll(() => responseReady).toBeTruthy();
    await respondWithMessage();

    await expect(page.getByText("KPI line 1: placeholder text.")).toBeVisible();

    const marker = page.getByTestId("chat-new-message-marker");
    await expect(marker).toBeVisible();
  });

  test("internal note toggle sends staff-only visibility and stays active", async ({ page }) => {
    const requests: Array<Record<string, unknown>> = [];

    await page.route("**/api/chat/stream", async (route) => {
      const payload = route.request().postDataJSON();
      const body = isRecord(payload) ? payload : {};
      requests.push(body);
      const visibility = body.visibility === "internal" ? "internal" : "public";
      const content = visibility === "internal" ? "Internal note saved." : "OK.";
      const events = [
        {
          type: "data",
          data: {
            conversationId: "conv-1",
            messageId: `assistant_${requests.length}`,
            content,
            visibility,
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

    await openChat(page);

    const internalToggle = page.getByRole("button", { name: "Internal note" });
    await internalToggle.click();
    await expect(internalToggle).toHaveAttribute("aria-pressed", "true");

    const internalInput = page.getByPlaceholder("Internal note for staff...");
    await internalInput.fill("Follow up with guest about late checkout.");
    await internalInput.press("Enter");

    await expect(
      page.getByTestId("chat-message-list").getByText("Internal note").first(),
    ).toBeVisible();
    await expect(page.getByText("Internal note saved.")).toBeVisible();
    expect(requests[0]?.visibility).toBe("internal");

    await expect(internalToggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByPlaceholder("Internal note for staff...")).toBeVisible();
  });
});
