import { expect, test } from "@playwright/test";

const viewports = [
  { name: "mobile", width: 390, height: 844, definitionColumns: 1 },
  { name: "desktop", width: 1440, height: 1200, definitionColumns: 2 },
] as const;

for (const viewport of viewports) {
  test(`session tables and definition lists are readable on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/sessions/00-onboarding/");

    const table = page.locator("#function-and-value table");
    const tableHeading = table.locator("thead th").first();
    const definitions = page.locator("#people dl");
    const firstTerm = definitions.locator("dt").first();

    await expect(table).toBeVisible();
    await expect(definitions).toBeVisible();

    const tableStyle = await table.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        borderTopWidth: style.borderTopWidth,
        width: element.getBoundingClientRect().width,
        parentWidth: element.parentElement?.getBoundingClientRect().width ?? 0,
      };
    });
    expect(tableStyle.borderTopWidth).toBe("2px");
    expect(tableStyle.width).toBeLessThanOrEqual(tableStyle.parentWidth + 1);
    await expect(tableHeading).toHaveCSS(
      "background-color",
      "rgb(188, 235, 215)",
    );

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
