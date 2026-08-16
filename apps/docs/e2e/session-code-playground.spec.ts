import { expect, test } from "@playwright/test";
import { sessions } from "../src/sessions/catalog";

const exerciseSessions = sessions.filter(({ kind }) => kind === "exercise");

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 1200 },
] as const;

for (const viewport of viewports) {
  test(`/sessions/00-system-handover/ keeps the current-system observation usable on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/sessions/00-system-handover/");

    const content = page.locator(".case-file__content");
    const currentBusiness = page.locator("#incident");
    const currentSystem = page.locator("#legacy");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "業務とシステムを引き継ぐ",
    );
    await expect(currentBusiness.locator("dl")).toBeVisible();
    await expect(currentBusiness).toContainText("受付");
    await expect(currentBusiness).toContainText("獣医師");
    await expect(currentBusiness).toContainText("飼い主");
    await expect(currentSystem.locator("table")).toHaveCount(2);
    await expect(currentSystem).toContainText("予約データ");
    await expect(currentSystem).toContainText("カルテ");
    await expect(currentSystem).toContainText("会計データ");
    await expect(currentSystem).toContainText("調査ログ");
    await expect(content.locator(".session-code-overview")).toHaveCount(0);
    await expect(content.locator("[data-code-explorer]")).toHaveCount(0);
    await expect(content.locator(".session-code-playground")).toHaveCount(0);
    await expect(content.locator(".workflow-risk-map")).toHaveCount(0);
    await expect(content.locator('[data-action="run"]')).toHaveCount(0);
    await expect(content.locator('[data-action="reset"]')).toHaveCount(0);
    await expect(content.locator('[aria-label="実行結果"]')).toHaveCount(0);

    const widths = await content.evaluate((element) => ({
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

for (const session of exerciseSessions) {
  const route = `/sessions/${session.slug}/`;
  for (const viewport of viewports) {
    test(`${route} keeps the playground usable on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(route);

      const playground = page.locator(".session-code-playground");
      expect(await page.evaluate(() => globalThis.crossOriginIsolated)).toBe(true);
      await expect(playground).toBeVisible();
      await expect(playground.locator('[aria-label^="コードエディタ:"]')).toBeVisible();
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
