import { expect, test } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1440, height: 900, minimumPadding: 24 },
  { name: "mobile", width: 390, height: 844, minimumPadding: 20 },
] as const;

for (const viewport of viewports) {
  test(`予約カードの内容に十分な余白がある: ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const card = page.locator(".clinic-appointment");
    await expect(card).toBeVisible();
    const padding = await card.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        bottom: Number.parseFloat(style.paddingBottom),
        left: Number.parseFloat(style.paddingLeft),
        right: Number.parseFloat(style.paddingRight),
        top: Number.parseFloat(style.paddingTop),
      };
    });

    expect(padding.top).toBeGreaterThanOrEqual(viewport.minimumPadding);
    expect(padding.right).toBeGreaterThanOrEqual(viewport.minimumPadding);
    expect(padding.bottom).toBeGreaterThanOrEqual(viewport.minimumPadding);
    expect(padding.left).toBeGreaterThanOrEqual(viewport.minimumPadding);
  });
}
