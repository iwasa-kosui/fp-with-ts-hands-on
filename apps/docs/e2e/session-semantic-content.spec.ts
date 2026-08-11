import { expect, test } from "@playwright/test";

const viewports = [
  { name: "mobile", width: 390, height: 844, definitionColumns: 1 },
  { name: "desktop", width: 1440, height: 1200, definitionColumns: 2 },
] as const;

for (const viewport of viewports) {
  test(`Session 00 の検証範囲は ${viewport.name} でも読みやすい`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/sessions/00-onboarding/");

    const verification = page.locator("#onboarding-verification");
    const definitions = verification.locator("dl");
    const firstTerm = definitions.locator("dt").first();

    await expect(verification.getByRole("heading", { name: "開始状態を確認する" })).toBeVisible();
    await expect(definitions).toBeVisible();
    await expect(definitions.locator("dt")).toHaveCount(3);
    await expect(definitions).toContainText("型で守ること");
    await expect(definitions).toContainText("統合テストで守ること");
    await expect(definitions).toContainText("人がレビューすること");

    const definitionStyle = await definitions.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        borderTopWidth: style.borderTopWidth,
        display: style.display,
        columns: style.gridTemplateColumns.split(" ").filter(Boolean).length,
      };
    });
    expect(definitionStyle).toEqual({
      borderTopWidth: "2px",
      display: "grid",
      columns: viewport.definitionColumns,
    });
    await expect(firstTerm).toHaveCSS("background-color", "rgb(255, 242, 159)");

    const pageWidths = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(pageWidths.scrollWidth).toBeLessThanOrEqual(
      pageWidths.clientWidth + 1,
    );
  });
}
