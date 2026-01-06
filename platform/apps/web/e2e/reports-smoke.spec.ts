import { test, expect } from "@playwright/test";

test.describe("Reports page smoke", () => {
  test("loads without errors and renders tabs", async ({ page }) => {
    await page.goto("/");
    // Navigate to reports via direct URL to keep the smoke fast.
    await page.goto("/reports");

    // Basic load check: main heading and key tab buttons present.
    await expect(page.getByRole("heading", { name: /reports/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /daily/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /revenue/i })).toBeVisible();

    // Navigate to a report via the dropdown to ensure routing works.
    await page.getByRole("button", { name: /revenue/i }).click();
    await page.getByRole("menuitem", { name: /revenue overview/i }).click();
    await expect(page).toHaveURL(/\/reports\/revenue\/revenue-overview/);
    await expect(page.getByText(/revenue overview/i)).toBeVisible();
  });
});
