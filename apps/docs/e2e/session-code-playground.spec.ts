import { expect, test } from "@playwright/test";

const routes = [
  "/sessions/00-onboarding/",
  "/sessions/01-invariants/",
  "/sessions/02-state-vocabulary/",
  "/sessions/03-state-transitions/",
  "/sessions/04-awaiting-payment/",
  "/sessions/05-cancellation/",
  "/sessions/06-input-boundary/",
  "/sessions/07-meaningful-values/",
  "/sessions/08-pii-output/",
  "/sessions/09-typed-failures/",
  "/sessions/10-success-events/",
  "/sessions/11-use-case-ports/",
  "/sessions/12-atomicity-and-conflicts/",
  "/sessions/13-safe-follow-up/",
  "/sessions/final/",
] as const;

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 1200 },
] as const;

for (const route of routes) {
  for (const viewport of viewports) {
    test(`${route} keeps the playground usable on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(route);

      const playground = page.locator(".session-code-playground");
      await expect(playground).toBeVisible();
      await expect(playground.locator(".code-explorer__monaco")).toBeVisible();
      await expect(playground.locator('[data-action="reset"]')).toBeVisible();
      await expect(playground.locator('[data-action="run"]')).toBeVisible();
      await expect(playground.locator('[aria-label="実行結果"]')).toBeVisible();
      const widths = await playground.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth + 1);
      const pageWidths = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(pageWidths.scrollWidth).toBeLessThanOrEqual(pageWidths.clientWidth + 1);
    });
  }
}
