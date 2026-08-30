import { expect, test } from "@playwright/test";

const sessions = [
  { slug: "00-system-handover", title: "業務とシステムを引き継ぐ" },
  {
    slug: "01-business-events-and-workflows",
    title: "EventStormingとROPで予約キャンセルを設計する",
  },
  { slug: "02-state-transitions", title: "予約の状態と遷移をモデル化する" },
  {
    slug: "03-semantic-identifiers",
    title: "診察開始の識別子を型で区別する",
  },
  {
    slug: "04-boundaries-and-pii",
    title: "診察開始の入力を境界で検証する",
  },
  {
    slug: "05-workflow-errors",
    title: "失敗をユースケースの結果として扱う",
  },
  {
    slug: "06-effects-and-consistency",
    title: "副作用と整合性境界を設計する",
  },
  { slug: "final", title: "参照実装で境界をたどる" },
] as const;

const exerciseSessions = [
  { slug: "02-state-transitions", problemCount: 4, failureCount: 4 },
  { slug: "03-semantic-identifiers", problemCount: 3, failureCount: 3 },
  { slug: "04-boundaries-and-pii", problemCount: 2, failureCount: 2 },
  { slug: "05-workflow-errors", problemCount: 4, failureCount: 6 },
  { slug: "06-effects-and-consistency", problemCount: 4, failureCount: 4 },
] as const;

test("S1 shows ROP as two rails with three failure switches", async ({ page }) => {
  await page.goto("/sessions/01-business-events-and-workflows/");

  const diagram = page.locator("#rop .rop-basics__diagram");
  await expect(diagram).toContainText("成功レール");
  await expect(diagram).toContainText("失敗レール");
  await expect(diagram.locator("[data-rop-switch]")).toHaveCount(3);
  await expect(diagram).toContainText("入力を検査する");
  await expect(diagram).toContainText("対象を取得する");
  await expect(diagram).toContainText("権限と状態を");
  await expect(diagram).toContainText("結果を作る");
  await expect(diagram).not.toContainText(/Result|andThen|map|DB|メール|HTTP/);
});

test("S1 maps appointment cancellation into a single-aggregate event-output workflow", async ({
  page,
}) => {
  await page.goto("/sessions/01-business-events-and-workflows/");

  const diagram = page.locator(
    "#io-boundaries .dmmf-comparison__diagram",
  );
  await expect(diagram).toContainText("予約をキャンセルする");
  await expect(diagram).toContainText("AppointmentCanceled");
  await expect(diagram).toContainText("Appointment");
  await expect(diagram).toContainText(".cancel");
  await expect(diagram).toContainText("確認する条件");
  await expect(diagram).toContainText("集約");
  await expect(diagram).toContainText("実行者を取得する");
  await expect(diagram).toContainText("予約を取得する");
  await expect(diagram.locator("[data-eventstorming-policy]")).toHaveCount(0);
  await expect(diagram.locator("[data-eventstorming-aggregate]")).toHaveCount(1);
  await expect(diagram.locator("[data-business-rules]")).toHaveCount(1);
  await expect(
    diagram.locator('[data-mapping="aggregate-to-domain-decision"]'),
  ).toHaveCount(1);
  await expect(diagram.locator("[data-domain-decision]")).toHaveCount(1);
  await expect(diagram.locator("[data-workflow-switch]")).toHaveCount(0);
  await expect(diagram.locator("[data-store-switch]")).toHaveCount(0);
  await expect(diagram.locator('[data-flow="success-event-to-store"]')).toHaveCount(1);
  await expect(diagram).not.toContainText(
    /ExamResultRecorded|AppointmentExaminationCompleted|Queue|Unauthorized|AppointmentNotFound|InvalidAppointmentState|AppointmentConflict/,
  );
  await expect(page.locator("main")).not.toContainText(
    "S2〜S6で実装する部分を確認する",
  );
});

test("S1 separates ROP and I/O into four top-level learning sections", async ({
  page,
}) => {
  await page.goto("/sessions/01-business-events-and-workflows/");

  const main = page.locator("main");
  const sectionHeadings = await main
    .locator("article > section > h2")
    .allTextContents();
  expect(sectionHeadings).toEqual([
    "起きた出来事から業務を始める",
    "コマンド、確認する条件、集約を見つける",
    "ROPで失敗の経路を設計する",
    "I/Oをドメインロジックの両端へ追い出す",
  ]);

  const headings = await main.locator("h2, h3").allTextContents();
  expect(headings.some((heading) => /^\d{1,2}:\d{2}/.test(heading.trim()))).toBe(
    false,
  );

  const rop = main.locator("#rop");
  await expect(rop.locator(":scope > h2 + p")).toHaveCount(1);
  await expect(rop).toContainText("一部だけ処理されて不整合");
  await expect(rop.locator("dl")).toHaveCount(1);
  await expect(rop.locator("dl dt")).toHaveText([
    "入力",
    "ユースケースの確認",
    "ドメインロジック",
    "成功時の出力",
  ]);

  const ioBoundaries = main.locator("#io-boundaries");
  await expect(ioBoundaries.locator(":scope > h2 + p")).toHaveCount(1);
  await expect(ioBoundaries).toContainText(
    "データベースのAPIから切り離して値だけでテストでき",
  );
  await expect(ioBoundaries).toContainText("ビジネスユースケース");
  await expect(ioBoundaries).toContainText("pure");
  await expect(ioBoundaries).toContainText("Event Store");
  await expect(ioBoundaries).toContainText(
    "成功イベントをそのまま履歴として追記でき",
  );
  await expect(ioBoundaries.locator("h3")).toHaveText([
    "ビジネスユースケース、ドメインモデル、ユースケースを区別する",
    "なぜResolverとStoreをドメインロジックの外へ置くのか",
    "入力側：Resolverの役割",
    "出力側：Storeの役割",
    "このハンズオンでEvent Storeを選ぶ理由",
    "S1で残す成果物",
  ]);

  await expect(main.getByText("顧客にとって", { exact: true })).toHaveCount(0);
  await expect(main.getByText("技術者にとって", { exact: true })).toHaveCount(0);
});

for (const width of [390, 1440]) {
  test(`S1 diagrams stay inside the page at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1200 });
    await page.goto("/sessions/01-business-events-and-workflows/");

    const pageWidths = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(pageWidths.scrollWidth).toBeLessThanOrEqual(pageWidths.clientWidth + 1);

    if (width === 390) {
      for (const selector of [
        ".rop-basics__viewport",
        ".dmmf-comparison__viewport",
      ]) {
        const dimensions = await page.locator(selector).evaluate((element) => ({
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
        }));
        expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
      }
    }
  });
}

for (const session of exerciseSessions) {
  test(`${session.slug} explains each initial exercise failure before the command`, async ({
    page,
  }) => {
    await page.goto(`/sessions/${session.slug}/`);

    const legacy = page.locator("#legacy");
    const heading = legacy.getByRole("heading", {
      level: 3,
      name: "修正前の失敗を確認する",
    });
    const failures = legacy.getByRole("list", {
      name: "修正前に確認する問題",
    });
    const command = legacy.locator('.command-block[data-phase="red"]');

    await expect(heading).toBeVisible();
    await expect(failures).toBeVisible();
    await expect(failures.getByRole("listitem")).toHaveCount(
      session.problemCount,
    );
    await expect(command).toContainText(
      `${session.failureCount}件の演習テストが失敗します。`,
    );

    const order = await legacy.evaluate((element) => {
      const headingElement = Array.from(element.querySelectorAll("h3")).find(
        ({ textContent }) => textContent?.trim() === "修正前の失敗を確認する",
      );
      const failuresElement = element.querySelector(
        '[aria-label="修正前に確認する問題"]',
      );
      const commandElement = element.querySelector(
        '.command-block[data-phase="red"]',
      );

      return [headingElement, failuresElement, commandElement].map((child) =>
        child === undefined || child === null
          ? -1
          : Array.from(element.children).indexOf(child),
      );
    });

    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order[0]).toBeLessThan(order[1] ?? -1);
    expect(order[1]).toBeLessThan(order[2] ?? -1);
  });
}

test("S3 shows the swapped identifiers before proving that typecheck misses them", async ({
  page,
}) => {
  await page.goto("/sessions/03-semantic-identifiers/");

  const legacy = page.locator("#legacy");
  const swappedCode = legacy.locator(
    '[data-code-guide-card="swapped-domain-identifiers"]',
  );
  const typecheck = legacy.locator('[data-typecheck-reproduction]');

  await expect(swappedCode).toContainText(
    "acceptAppointmentId(veterinarianId);",
  );
  await expect(swappedCode).toContainText(
    "acceptVeterinarianId(appointmentId);",
  );
  await expect(typecheck).toContainText(
    "pnpm --filter @fp-with-ts/clinic-session-03 typecheck",
  );
  await expect(typecheck).toContainText(
    "取り違えた2行が残っていても、型検査は成功します。",
  );

  const swappedCodePrecedesTypecheck = await legacy.evaluate((element) => {
    const swappedCodeElement = element.querySelector(
      '[data-code-guide-card="swapped-domain-identifiers"]',
    );
    const typecheckElement = element.querySelector(
      "[data-typecheck-reproduction]",
    );

    return swappedCodeElement !== null && typecheckElement !== null
      ? Boolean(
          swappedCodeElement.compareDocumentPosition(typecheckElement) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        )
      : false;
  });

  expect(swappedCodePrecedesTypecheck).toBe(true);
});

for (const session of sessions) {
  test(`${session.slug} introduces its episode after the first section heading`, async ({
    page,
  }) => {
    await page.goto(`/sessions/${session.slug}/`);

    await expect(
      page.locator(".case-file__hero .case-file__episode"),
    ).toHaveCount(0);

    const firstSectionChildren = await page
      .locator(".case-file__content > section")
      .first()
      .evaluate((section) =>
        Array.from(section.children)
          .slice(0, 2)
          .map((element) => ({
            tagName: element.tagName,
            isEpisode: element.classList.contains("case-file__episode"),
          })),
      );

    expect(firstSectionChildren).toEqual([
      { tagName: "H2", isEpisode: false },
      { tagName: "ASIDE", isEpisode: true },
    ]);
  });
}

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
