import { expect, test } from "@playwright/test";

test("setup page presents the two required preparations", async ({ page }) => {
  await page.goto("/setup/");

  await expect(page.getByRole("heading", { level: 1, name: "事前準備" })).toBeVisible();

  const steps = page
    .getByRole("list", { name: "事前準備の手順" })
    .getByRole("listitem");
  await expect(steps).toHaveCount(2);

  const discordLink = steps
    .nth(0)
    .getByRole("link", { name: "Discordサーバーに参加する" });
  await expect(discordLink).toHaveAttribute(
    "href",
    "https://discord.gg/Mq3GVSvRG",
  );

  await expect(steps.nth(1)).toContainText(
    "git clone https://github.com/iwasa-kosui/fp-with-ts-hands-on.git",
  );
  await expect(steps.nth(1).getByRole("button", { name: "コピー" })).toBeVisible();
});

test("session directory links to the setup page", async ({ page }) => {
  await page.goto("/sessions/");

  await expect(
    page.getByRole("link", { name: "事前準備を確認する" }),
  ).toHaveAttribute("href", "/setup/");
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
