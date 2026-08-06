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

test("home hero renders event metadata at a readable size", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto("/");

  const fontSize = await page.locator(".landing-eyebrow").evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );

  expect(fontSize).toBeGreaterThanOrEqual(16);
});

test("home hero omits the decorative dog badge", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto("/");

  await expect(page.locator(".floating-pet--dog")).toHaveCount(0);
});
