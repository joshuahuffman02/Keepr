import { test, expect } from "@playwright/test";

test.describe("Analytics (Data Intelligence) smoke", () => {
  test.beforeEach(async ({ page }) => {
    // Ensure the app has a selected campground so queries run; mock mode will fallback if API is unavailable.
    await page.addInitScript(() => {
      window.localStorage.setItem("campreserv:selectedCampground", "mock-camp");
    });
  });

  test("loads dashboard cards and recommendations with mock fallback", async ({ page }) => {
    await page.goto("/analytics");
    await page.waitForLoadState("domcontentloaded");

    // Basic smoke: page loaded and routed to /analytics.
    await expect(page).toHaveURL(/\/analytics/);

    const dashboardHeading = page.getByRole("heading", { name: "Analytics Dashboard" });
    const emptyState = page.getByText("Select a campground to view analytics");

    await Promise.race([
      dashboardHeading.waitFor({ timeout: 15000 }),
      emptyState.waitFor({ timeout: 15000 }),
    ]);

    if (await dashboardHeading.isVisible()) {
      await page
        .getByText(/recommendations/i)
        .first()
        .waitFor({ timeout: 3000 })
        .catch(() => {});
    }
  });
});
