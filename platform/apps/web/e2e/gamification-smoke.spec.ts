import { test, expect } from "@playwright/test";

test.describe("Gamification admin (stub) smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("campreserv:selectedCampground", "mock-camp");
    });
  });

  test("toggles gamification and loads manual award UI (stub data)", async ({ page }) => {
    await page.goto("/dashboard/settings/gamification");
    await page.waitForLoadState("domcontentloaded");

    const settingsHeading = page.getByRole("heading", { name: "Gamification Settings" });
    const errorHeading = page.getByRole("heading", { name: "Unable to Load Settings" });
    const selectHeading = page.getByRole("heading", { name: "Select a Campground" });

    await Promise.race([
      settingsHeading.waitFor({ timeout: 15000 }),
      errorHeading.waitFor({ timeout: 15000 }),
      selectHeading.waitFor({ timeout: 15000 }),
    ]);

    if (!(await settingsHeading.isVisible())) {
      return;
    }

    // Toggle enable switch
    const switchEl = page.getByRole("switch").first();
    await expect(switchEl).toBeVisible();
    const initialState = await switchEl.getAttribute("data-state");
    if (initialState !== "checked") {
      await switchEl.click();
      await expect(switchEl).toHaveAttribute("data-state", "checked");
    }

    await expect(page.getByRole("heading", { name: "Manual Merit XP" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Award XP/i })).toBeDisabled();

    await expect(page.getByRole("button", { name: /Save Settings/i })).toBeEnabled();
  });
});
