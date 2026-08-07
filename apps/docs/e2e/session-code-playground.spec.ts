import { expect, test } from "@playwright/test";

const routes = [
  "/sessions/00-break-the-app/",
  "/sessions/00-read-the-incident/",
  "/sessions/01-state-modeling/",
  "/sessions/02-boundary-and-ids/",
  "/sessions/03-result-errors/",
  "/sessions/04-agent-review/",
  "/sessions/05-mini-integration/",
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
      await expect(playground.locator('[data-action="reset"]')).toBeVisible();
      await expect(playground.locator('[data-action="run"]')).toBeVisible();
      const widths = await playground.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth + 1);
    });
  }
}
