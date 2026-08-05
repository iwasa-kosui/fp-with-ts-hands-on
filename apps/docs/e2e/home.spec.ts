import { expect, test } from "@playwright/test";

test("desktop home keeps its approved appearance", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto("/");
  await expect(page).toHaveScreenshot("home-desktop.png", {
    animations: "disabled",
    fullPage: true,
  });
});

test("mobile home keeps its approved appearance", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page).toHaveScreenshot("home-mobile.png", {
    animations: "disabled",
    fullPage: true,
  });
});
