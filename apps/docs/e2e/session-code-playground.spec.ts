import { expect, test } from "@playwright/test";
import { sessions } from "../src/sessions/catalog";

const exerciseSessions = sessions.filter(({ kind }) => kind === "exercise");

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 1200 },
] as const;

for (const viewport of viewports) {
  test(`/sessions/00-onboarding/ keeps the guided overview usable on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/sessions/00-onboarding/");

    const overview = page.locator(".session-code-overview");
    const defaultIssue = overview.getByRole("button", {
      name: "状態を任意の文字列で表している",
    });
    const optionalDataIssue = overview.getByRole("button", {
      name: "状態固有の情報が optional field に広がっている",
    });
    const guideDetail = overview.locator(".code-explorer__guide-detail");
    const editor = overview.getByLabel("コードエディタ: src/legacy/appointment.ts");

    await expect(overview).toBeVisible();
    await expect(overview.getByRole("list", { name: "設計課題" })).toBeVisible();
    await expect(overview.locator("[data-code-guide]")).toHaveCount(5);
    await expect(defaultIssue).toHaveAttribute("aria-pressed", "true");
    await expect(guideDetail).toContainText(
      "status と更新先の状態を string で受け取っています。",
    );
    await expect(editor).toBeVisible();
    const editorInput = overview.getByRole("textbox");
    await editorInput.focus();
    await expect(editorInput).toBeFocused();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.insertText("__READ_ONLY_PROBE__");
    await expect(editor).not.toContainText("__READ_ONLY_PROBE__");
    const highlightedLines = overview.locator(".code-explorer__highlighted-line");
    expect(await highlightedLines.count()).not.toBe(8);

    await optionalDataIssue.click();

    await expect(defaultIssue).toHaveAttribute("aria-pressed", "false");
    await expect(optionalDataIssue).toHaveAttribute("aria-pressed", "true");
    await expect(guideDetail).toContainText(
      "診察、会計、キャンセルの情報が1つの optional field 群に同居しています。",
    );
    await expect(guideDetail).toContainText(
      "どの状態で何が必須なのかを型から判断できません。",
    );
    await expect(editor).toBeVisible();
    await expect(highlightedLines).toHaveCount(8);
    expect(
      await highlightedLines.first().evaluate(
        (line) => getComputedStyle(line).backgroundColor,
      ),
    ).not.toBe("rgba(0, 0, 0, 0)");
    await expect(overview.locator('[data-action="run"]')).toHaveCount(0);
    await expect(overview.locator('[data-action="reset"]')).toHaveCount(0);
    await expect(overview.locator('[aria-label="実行結果"]')).toHaveCount(0);

    const widths = await overview.evaluate((element) => ({
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
