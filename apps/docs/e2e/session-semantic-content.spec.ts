import { expect, test } from "@playwright/test";

const sessions = [
  { slug: "00-system-handover", title: "業務とシステムを引き継ぐ" },
  {
    slug: "01-business-events-and-workflows",
    title: "ビジネスイベントからワークフローを描く",
  },
  { slug: "02-state-transitions", title: "予約の状態と遷移をモデル化する" },
  {
    slug: "03-semantic-identifiers",
    title: "用途の異なる識別子を型で区別する",
  },
  {
    slug: "04-boundaries-and-pii",
    title: "外部入力を境界で検証し個人情報を守る",
  },
  {
    slug: "05-workflow-errors",
    title: "失敗をワークフローの結果として扱う",
  },
  {
    slug: "06-effects-and-consistency",
    title: "副作用と整合性境界を設計する",
  },
  { slug: "final", title: "参照実装で境界をたどる" },
] as const;

const viewports = [
  { name: "mobile", width: 390, height: 844, definitionColumns: 1 },
  { name: "desktop", width: 1440, height: 1200, definitionColumns: 2 },
] as const;

for (const session of sessions) {
  for (const viewport of viewports) {
    test(`${session.slug} has no horizontal overflow on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`/sessions/${session.slug}/`);

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        session.title,
      );
      const pageWidths = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(pageWidths.scrollWidth).toBeLessThanOrEqual(pageWidths.clientWidth + 1);
    });
  }
}

for (const viewport of viewports) {
  test(`S0 current-system tables and role definitions are readable on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/sessions/00-system-handover/");

    const table = page.locator("#legacy table").first();
    const tableHeading = table.locator("thead th").first();
    const definitions = page.locator("#incident dl");
    const firstTerm = definitions.locator("dt").first();

    await expect(table).toBeVisible();
    await expect(definitions).toBeVisible();
    await expect(page.locator("#legacy table")).toHaveCount(2);
    await expect(definitions.locator("dt")).toHaveText(["受付", "獣医師", "飼い主"]);
    await expect(page.locator("#legacy")).toContainText("調査ログ");

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
  });
}

test("S2 pitfall source path stays inside its caption on mobile", async ({ page }) => {
  await page.setViewportSize(viewports[0]);
  await page.goto("/sessions/02-state-transitions/");

  const caption = page.locator("[data-pitfall-code] figcaption");
  await expect(caption).toBeVisible();
  const bounds = await caption.evaluate((element) => {
    const captionRect = element.getBoundingClientRect();
    const sourceRect = element.querySelector("code")!.getBoundingClientRect();
    return {
      captionRight: captionRect.right,
      sourceRight: sourceRect.right,
    };
  });

  expect(bounds.sourceRight).toBeLessThanOrEqual(bounds.captionRight + 1);
});

test("S2 teaching explanation clears the preceding code shadow on mobile", async ({
  page,
}) => {
  await page.setViewportSize(viewports[0]);
  await page.goto("/sessions/02-state-transitions/");

  const firstTopic = page.locator(".teaching-topic").first();
  const lastCodeBlock = firstTopic
    .locator(".teaching-topic__diff .code-block")
    .last();
  const explanation = firstTopic.locator(".teaching-topic__why");

  await expect(lastCodeBlock).toBeVisible();
  await expect(explanation).toBeVisible();
  const gap = await firstTopic.evaluate((topic) => {
    const codeRect = topic
      .querySelector(".teaching-topic__diff .code-block:last-child")!
      .getBoundingClientRect();
    const explanationRect = topic
      .querySelector(".teaching-topic__why")!
      .getBoundingClientRect();
    return explanationRect.top - codeRect.bottom;
  });

  expect(gap).toBeGreaterThanOrEqual(10);
});

test("S2 teaching explanation has no left accent line on mobile", async ({
  page,
}) => {
  await page.setViewportSize(viewports[0]);
  await page.goto("/sessions/02-state-transitions/");

  const explanation = page.locator(".teaching-topic__why").first();
  await expect(explanation).toBeVisible();
  await expect(explanation).toHaveCSS("border-left-width", "0px");
  await expect(explanation).toHaveCSS("padding-left", "0px");
});
