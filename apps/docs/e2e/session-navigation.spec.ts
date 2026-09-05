import { expect, test } from "@playwright/test";

const sessions = [
  { title: "業務とシステムを引き継ぐ", href: "/sessions/00-system-handover/" },
  {
    title: "EventStormingとROPで予約キャンセルを設計する",
    href: "/sessions/01-business-events-and-workflows/",
  },
  { title: "予約の状態と遷移をモデル化する", href: "/sessions/02-state-transitions/" },
  {
    title: "診察開始の識別子を型で区別する",
    href: "/sessions/03-semantic-identifiers/",
  },
  {
    title: "診察開始の入力を境界で検証する",
    href: "/sessions/04-boundaries-and-pii/",
  },
  { title: "失敗をユースケースの結果として扱う", href: "/sessions/05-workflow-errors/" },
  { title: "副作用と整合性境界を設計する", href: "/sessions/06-effects-and-consistency/" },
  { title: "参照実装で境界をたどる", href: "/sessions/final/" },
] as const;

const sessionTitles = sessions.map(({ title }) => title);

test("desktop nests the page outline under the current session beside the title and article", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto("/sessions/02-state-transitions/");

  const curriculum = page.locator(".case-file__curriculum--desktop");
  const currentSession = curriculum.locator("li").filter({
    has: page.locator('a[aria-current="page"]'),
  });
  const outline = currentSession.getByRole("navigation", { name: "ページ内目次" });
  const sessionLinks = curriculum.locator('a[href^="/sessions/"]');

  await expect(curriculum.getByRole("navigation", { name: "セッション一覧" })).toBeVisible();
  await expect(outline).toBeVisible();
  await expect(sessionLinks).toHaveCount(8);
  for (const [index, { href }] of sessions.entries()) {
    await expect(sessionLinks.nth(index)).toHaveAttribute("href", href);
    await expect(sessionLinks.nth(index)).toHaveAccessibleName(sessionTitles[index]!);
  }
  await expect(
    curriculum.getByRole("link", { name: "予約の状態と遷移をモデル化する" }),
  ).toHaveAttribute("aria-current", "page");

  const positions = await page.evaluate(() => {
    const curriculumRect = document
      .querySelector(".case-file__curriculum--desktop")!
      .getBoundingClientRect();
    const articleRect = document.querySelector(".case-file__content")!.getBoundingClientRect();
    const titleRect = document.querySelector(".case-file__hero")!.getBoundingClientRect();

    return {
      curriculumRight: curriculumRect.right,
      articleLeft: articleRect.left,
      titleLeft: titleRect.left,
      titleTop: titleRect.top,
      curriculumTop: curriculumRect.top,
    };
  });

  expect(positions.curriculumRight).toBeLessThanOrEqual(positions.articleLeft);
  expect(positions.curriculumRight).toBeLessThanOrEqual(positions.titleLeft);
  expect(Math.abs(positions.titleTop - positions.curriculumTop)).toBeLessThan(80);
  await outline.getByRole("link", { name: "型で閉じる" }).click();
  await expect(page).toHaveURL(/#refactor$/);
  await expect(outline.getByRole("link", { name: "型で閉じる" })).toHaveAttribute("aria-current", "location");
});

test("mobile shows the current session and opens one menu for both navigation levels", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/sessions/02-state-transitions/");

  const curriculumMenu = page.locator(".case-file__mobile-menu--curriculum");
  const outline = curriculumMenu.getByRole("navigation", { name: "ページ内目次" });
  const summary = curriculumMenu.locator("summary");

  await expect(summary).toContainText("現在地 3 / 8");
  await expect(summary).toContainText("予約の状態と遷移をモデル化する");
  await expect(curriculumMenu.getByRole("navigation", { name: "セッション一覧" })).toBeHidden();
  await expect(outline).toBeHidden();

  await summary.click();
  await expect(curriculumMenu.getByRole("navigation", { name: "セッション一覧" })).toBeVisible();
  await expect(curriculumMenu.locator('a[href^="/sessions/"]')).toHaveCount(8);
  await expect(outline).toBeVisible();
  await expect(outline.getByRole("link", { name: "今回つくるもの" })).toHaveAttribute(
    "href",
    "#incident",
  );

  await outline.getByRole("link", { name: "型で閉じる" }).click();
  await expect(page).toHaveURL(/#refactor$/);
  await expect(curriculumMenu).not.toHaveAttribute("open", "");
  await expect(curriculumMenu.locator('a[href="#refactor"]')).toHaveAttribute("aria-current", "location");

  const targetPosition = await page.evaluate(() => {
    const navigationRect = document
      .querySelector(".case-file__mobile-navigation")!
      .getBoundingClientRect();
    const targetRect = document
      .querySelector("#refactor")!
      .getBoundingClientRect();

    return {
      navigationBottom: navigationRect.bottom,
      targetTop: targetRect.top,
    };
  });

  expect(targetPosition.targetTop).toBeGreaterThanOrEqual(
    targetPosition.navigationBottom,
  );

  await summary.click();
  await summary.press("Escape");
  await expect(curriculumMenu).not.toHaveAttribute("open", "");
  await expect(summary).toBeFocused();
});

test("short desktop viewports keep every session reachable inside the left rail", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 600 });
  await page.goto("/sessions/02-state-transitions/");

  const curriculum = page.locator(".case-file__curriculum--desktop");
  const railMetrics = await curriculum.evaluate((element) => {
    const styles = getComputedStyle(element);

    return {
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: styles.overflowY,
    };
  });

  expect(railMetrics.clientHeight).toBeLessThanOrEqual(568);
  expect(railMetrics.scrollHeight).toBeGreaterThan(railMetrics.clientHeight);
  expect(railMetrics.overflowY).toBe("auto");

  const lastSession = curriculum.getByRole("link", {
    name: "参照実装で境界をたどる",
  });
  await lastSession.scrollIntoViewIfNeeded();
  await expect(lastSession).toBeVisible();
});

test("session navigation keeps its approved desktop appearance", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto("/sessions/02-state-transitions/");
  await expect(page).toHaveScreenshot("session-navigation-desktop.png", {
    animations: "disabled",
  });
});

test("mobile navigation keeps its current position visible when closed and shows the nested outline when open", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/sessions/02-state-transitions/");
  await expect(page).toHaveScreenshot("session-navigation-mobile.png", {
    animations: "disabled",
  });

  await page
    .locator(".case-file__mobile-menu--curriculum summary")
    .click();
  await expect(page).toHaveScreenshot("session-navigation-mobile-curriculum.png", {
    animations: "disabled",
  });
});

test("the final session stays in view on a short desktop and follows the current chapter", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 600 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/sessions/final/");
  const rail = page.locator(".case-file__curriculum--desktop");
  const current = rail.locator('[aria-current="page"]');
  await expect(current).toBeInViewport();
  await page.locator("#review").scrollIntoViewIfNeeded();
  await expect(rail.locator('a[href="#review"]')).toHaveAttribute("aria-current", "location");
  await expect(current).toBeInViewport();
});

test("the current session stays visible after rotating from mobile to a short desktop", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/sessions/final/");
  await page.setViewportSize({ width: 844, height: 390 });
  const current = page.locator('.case-file__curriculum--desktop [aria-current="page"]');
  await expect(current).toBeInViewport({ ratio: 1 });
  await page.setViewportSize({ width: 1100, height: 300 });
  await expect(current).toBeInViewport({ ratio: 1 });
});

for (const slug of ["05-workflow-errors", "06-effects-and-consistency"]) {
  test(`${slug} shows its whole current-session link below the site header on a short screen`, async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 600 });
    await page.goto(`/sessions/${slug}/`);
    await expect(page.locator('.case-file__curriculum--desktop [aria-current="page"]')).toBeInViewport({ ratio: 1 });
  });
}

for (const session of sessions) {
  test(`${session.href} keeps every chapter link attached to a real heading`, async ({ page }) => {
    await page.goto(session.href);
    const destinations = await page.locator(".case-file__curriculum--desktop [data-section]").evaluateAll((links) =>
      links.map((link) => {
        const section = document.getElementById(link.getAttribute("href")!.slice(1));
        return section?.querySelector("h2")?.textContent?.trim();
      }),
    );
    expect(destinations.length).toBeGreaterThan(0);
    expect(destinations.every((heading) => typeof heading === "string" && heading.length > 0)).toBe(true);
  });
}
