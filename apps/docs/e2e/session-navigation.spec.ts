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
    title: "入力を検証し、監査記録から個人情報を除く",
    href: "/sessions/04-boundaries-and-pii/",
  },
  { title: "失敗をユースケースの結果として扱う", href: "/sessions/05-workflow-errors/" },
  { title: "副作用と整合性境界を設計する", href: "/sessions/06-effects-and-consistency/" },
  { title: "参照実装で境界をたどる", href: "/sessions/final/" },
] as const;

const sessionTitles = sessions.map(({ title }) => title);

test("desktop shows the curriculum left of the article and the page outline right of it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto("/sessions/02-state-transitions/");

  const curriculum = page.locator(".case-file__curriculum--desktop");
  const outline = page.locator(".case-file__outline--desktop");

  await expect(curriculum.getByRole("navigation", { name: "セッション一覧" })).toBeVisible();
  await expect(outline.getByRole("navigation", { name: "ページ内目次" })).toBeVisible();
  await expect(curriculum.getByRole("link")).toHaveText(sessionTitles);
  for (const [index, { href }] of sessions.entries()) {
    await expect(curriculum.getByRole("link").nth(index)).toHaveAttribute("href", href);
  }
  await expect(
    curriculum.getByRole("link", { name: "予約の状態と遷移をモデル化する" }),
  ).toHaveAttribute("aria-current", "page");

  const positions = await page.evaluate(() => {
    const curriculumRect = document
      .querySelector(".case-file__curriculum--desktop")!
      .getBoundingClientRect();
    const articleRect = document.querySelector(".case-file__content")!.getBoundingClientRect();
    const outlineRect = document
      .querySelector(".case-file__outline--desktop")!
      .getBoundingClientRect();

    return {
      curriculumRight: curriculumRect.right,
      articleLeft: articleRect.left,
      articleRight: articleRect.right,
      outlineLeft: outlineRect.left,
    };
  });

  expect(positions.curriculumRight).toBeLessThanOrEqual(positions.articleLeft);
  expect(positions.articleRight).toBeLessThanOrEqual(positions.outlineLeft);
});

test("mobile keeps the curriculum and page outline in separate menus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/sessions/02-state-transitions/");

  const curriculumMenu = page.locator(".case-file__mobile-menu--curriculum");
  const outlineMenu = page.locator(".case-file__mobile-menu--outline");

  await expect(curriculumMenu.getByText("セッション一覧", { exact: true })).toBeVisible();
  await expect(outlineMenu.getByText("このページ", { exact: true })).toBeVisible();
  await expect(curriculumMenu.getByRole("navigation", { name: "セッション一覧" })).toBeHidden();
  await expect(outlineMenu.getByRole("navigation", { name: "ページ内目次" })).toBeHidden();

  await curriculumMenu.getByText("セッション一覧", { exact: true }).click();
  await expect(curriculumMenu.getByRole("navigation", { name: "セッション一覧" })).toBeVisible();
  await expect(curriculumMenu.getByRole("link")).toHaveText(sessionTitles);
  await expect(outlineMenu.getByRole("navigation", { name: "ページ内目次" })).toBeHidden();

  await outlineMenu.getByText("このページ", { exact: true }).click();
  await expect(curriculumMenu.getByRole("navigation", { name: "セッション一覧" })).toBeHidden();
  await expect(outlineMenu.getByRole("navigation", { name: "ページ内目次" })).toBeVisible();
  await expect(outlineMenu.getByRole("link", { name: "今回つくるもの" })).toHaveAttribute(
    "href",
    "#incident",
  );

  await outlineMenu.getByRole("link", { name: "型で閉じる" }).click();
  await expect(page).toHaveURL(/#refactor$/);
  await expect(outlineMenu).not.toHaveAttribute("open", "");

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
  await page.locator(".case-file__body").scrollIntoViewIfNeeded();

  await expect(page).toHaveScreenshot("session-navigation-desktop.png", {
    animations: "disabled",
  });
});

test("mobile navigation menus keep their approved open states", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/sessions/02-state-transitions/");
  await page.locator(".case-file__body").scrollIntoViewIfNeeded();

  await page
    .locator(".case-file__mobile-menu--curriculum")
    .getByText("セッション一覧", { exact: true })
    .click();
  await expect(page).toHaveScreenshot("session-navigation-mobile-curriculum.png", {
    animations: "disabled",
  });

  await page
    .locator(".case-file__mobile-menu--outline")
    .getByText("このページ", { exact: true })
    .click();
  await expect(page).toHaveScreenshot("session-navigation-mobile-outline.png", {
    animations: "disabled",
  });
});
