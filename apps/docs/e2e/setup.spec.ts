import { expect, test } from "@playwright/test";

test("setup page presents the required preparations through local verification", async ({
  page,
}) => {
  await page.goto("/setup/");

  await expect(page.getByRole("heading", { level: 1, name: "事前準備" })).toBeVisible();

  const steps = page
    .getByRole("list", { name: "事前準備の手順" })
    .getByRole("listitem");
  await expect(steps).toHaveCount(3);

  await expect(steps.nth(0)).toContainText("Node.js 20以上");
  await expect(steps.nth(0)).toContainText("pnpm 9.12.0");

  await expect(steps.nth(1)).toContainText(
    "git clone https://github.com/iwasa-kosui/fp-with-ts-hands-on.git",
  );
  await expect(steps.nth(1).getByRole("button", { name: "コピー" })).toBeVisible();

  await expect(steps.nth(2)).toContainText("cd fp-with-ts-hands-on");
  await expect(steps.nth(2)).toContainText("pnpm install --frozen-lockfile");
  await expect(steps.nth(2)).toContainText("pnpm test");
  await expect(steps.nth(2)).toContainText("pnpm dev");
  await expect(steps.nth(2).getByRole("button", { name: "コピー" })).toBeVisible();
});

test("session directory links to the setup page", async ({ page }) => {
  await page.goto("/sessions/");

  await expect(
    page.getByRole("link", { name: "事前準備ページを開く" }),
  ).toHaveAttribute("href", "/setup/");
});

test("mobile setup page keeps commands inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/setup/");

  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    page: document.documentElement.scrollWidth,
  }));

  expect(dimensions).toEqual({ viewport: 390, page: 390 });
});

test("desktop setup page keeps its approved appearance", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto("/setup/");
  await expect(page).toHaveScreenshot("setup-desktop.png", {
    animations: "disabled",
    fullPage: true,
  });
});

test("mobile setup page keeps its approved appearance", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/setup/");
  await expect(page).toHaveScreenshot("setup-mobile.png", {
    animations: "disabled",
    fullPage: true,
  });
});
