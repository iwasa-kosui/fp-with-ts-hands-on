import { expect, test } from "@playwright/test";

const contrastRatio = (foreground: string, background: string) => {
  const toRelativeLuminance = (color: string) => {
    const channels = color.match(/\d+(?:\.\d+)?/g)?.map(Number);
    if (channels?.length !== 3) {
      throw new Error(`Expected an opaque RGB color, received ${color}`);
    }

    const [red, green, blue] = channels.map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });

    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };

  const [lighter, darker] = [
    toRelativeLuminance(foreground),
    toRelativeLuminance(background),
  ].sort((left, right) => right - left);

  return (lighter + 0.05) / (darker + 0.05);
};

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

test("home hero renders the learning topic at a readable size", async ({ page }) => {
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

test("home page does not force focus on initial load", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("body")).toBeFocused();
});

test("home START SESSION CTA opens the session directory", async ({ page }) => {
  await page.goto("/");

  const cta = page.getByRole("link", { name: "START SESSION" });
  await expect(cta).toHaveAttribute("href", "/sessions/");
  await cta.click();

  await expect(page).toHaveURL(/\/sessions\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "セッション一覧" })).toBeVisible();
});

test("home navigation identifies its mixed destinations", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("navigation", { name: "メインナビゲーション" })).toBeVisible();
});

test("home START SESSION CTA keeps readable contrast on hover and keyboard focus", async ({ page }) => {
  await page.goto("/");

  const cta = page.getByRole("link", { name: "START SESSION" });
  await cta.hover();
  const hoverColors = await cta.evaluate((element) => {
    const style = getComputedStyle(element);
    return { foreground: style.color, background: style.backgroundColor };
  });
  expect(contrastRatio(hoverColors.foreground, hoverColors.background)).toBeGreaterThanOrEqual(4.5);

  await page.mouse.move(0, 0);
  expect(await cta.evaluate((element) => element.matches(":hover"))).toBe(false);
  await page.locator("body").focus();
  for (let attempts = 0; attempts < 10; attempts += 1) {
    if (await cta.evaluate((element) => document.activeElement === element)) {
      break;
    }
    await page.keyboard.press("Tab");
  }
  await expect(cta).toBeFocused();

  const focusStyle = await cta.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      foreground: style.color,
      background: style.backgroundColor,
      outlineColor: style.outlineColor,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    };
  });
  expect(contrastRatio(focusStyle.foreground, focusStyle.background)).toBeGreaterThanOrEqual(4.5);
  expect(focusStyle.outlineColor).toBe("rgb(179, 32, 99)");
  expect(focusStyle.outlineStyle).toBe("solid");
  expect(focusStyle.outlineWidth).toBe("3px");
});
