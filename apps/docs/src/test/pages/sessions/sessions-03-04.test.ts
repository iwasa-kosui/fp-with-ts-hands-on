import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import ResultErrorsPage from "../../../pages/sessions/03-result-errors.astro";
import AgentReviewPage from "../../../pages/sessions/04-agent-review.astro";
import { createAstroContainer } from "../../render-astro";

const parseStaticMarkup = (html: string): Document =>
  new DOMParser().parseFromString(
    html.replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/g, ""),
    "text/html",
  );

const readPage = (slug: string): string =>
  readFileSync(
    new URL("../../../pages/sessions/" + slug + ".astro", import.meta.url),
    "utf8",
  );

const expectCommandBlock = (
  source: string,
  phase: "red" | "green",
  command: string,
): void => {
  const commandBlocks = source.match(/<CommandBlock\b[\s\S]*?\/>/g) ?? [];
  const hasAttribute = (block: string, name: string, value: string): boolean => {
    const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(
      `(?:^|\\s)${name}\\s*=\\s*(["'])${escapedValue}\\1`,
    ).test(block);
  };

  expect(
    commandBlocks.some(
      (block) =>
        hasAttribute(block, "phase", phase) &&
        hasAttribute(block, "command", command),
    ),
  ).toBe(true);
};

const expectAuthoredOutline = (
  document: Document,
  chapters: readonly string[],
): void => {
  expect(
    [...document.querySelectorAll("article h2")].map(({ textContent }) =>
      textContent?.trim(),
    ),
  ).toEqual(chapters);

  const tocLinks = [
    ...document.querySelectorAll('nav[aria-label="ページ内目次"] a'),
  ];
  expect(tocLinks).toHaveLength(chapters.length * 2);
  expect(tocLinks.every((link) => link.id === "")).toBe(true);

  const tocTargets = [
    ...new Set(tocLinks.map((link) => link.getAttribute("href"))),
  ];
  expect(tocTargets).toHaveLength(chapters.length);

  for (const target of tocTargets) {
    expect(target).toMatch(/^#[a-z0-9-]+$/);
    expect(document.querySelectorAll(`article h2${target}`)).toHaveLength(1);
  }

  expect(
    document.querySelectorAll(
      ".command-block h1, .command-block h2, .command-block h3",
    ),
  ).toHaveLength(0);
};

describe("Sessions 03 and 04", () => {
  it("uses each session's starting snapshot and verification command", () => {
    const resultErrors = readPage("03-result-errors");
    const agentReview = readPage("04-agent-review");

    expect(resultErrors).toContain("examples/session-03/src/domain/");
    expect(resultErrors).toContain("examples/session-03/src/boundary/");
    expectCommandBlock(resultErrors, "red", "pnpm exercise:03");
    expectCommandBlock(resultErrors, "green", "pnpm exercise:03");
    expect(resultErrors).toContain(
      "pnpm --filter @fp-with-ts/clinic-session-03 test",
    );
    expect(resultErrors).toContain(
      "eventStore.append(ExaminationStarted.create",
    );
    expect(resultErrors).not.toContain("input.eventStore.append");
    expect(agentReview).toContain(
      "examples/session-04/src/application/start-examination.ts",
    );
    expect(agentReview).toContain("dual-write");
    expectCommandBlock(agentReview, "red", "pnpm exercise:04");
    expectCommandBlock(agentReview, "green", "pnpm exercise:04");
    expect(agentReview).toContain(
      "pnpm --filter @fp-with-ts/clinic-session-04 test",
    );
    expect(agentReview).toContain(
      "examples/session-04/src/review/agent-review.ts",
    );
    expect(agentReview).toContain("実装する source");
    expect(agentReview).toContain("2つの export を実装");
    expect(resultErrors).not.toContain("packages/clinic-example");
    expect(agentReview).not.toContain("packages/clinic-example");
  });

  it("separates typed failures from successful domain events", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(ResultErrorsPage, {
      partial: false,
    });

    expect(html).toContain("StartExaminationError");
    expect(html).toContain("ExaminationStarted");
    expect(html).toContain("成功時だけ記録");
    expect(html).toContain("exercise:03");

    expectAuthoredOutline(parseStaticMarkup(html), [
      "要求と結果の責任を分ける",
      "失敗を値として扱う",
      "ブラウザで試す",
      "成功した変更だけを記録する",
      "レビューと適用範囲を確認する",
    ]);
  });

  it("separates agent instructions from human review", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(AgentReviewPage, {
      partial: false,
    });

    expect(html).toContain("型とテストで検証できること");
    expect(html).toContain("人が要求から判断すること");
    expect(html).toContain("状態遷移");
    expect(html).toContain("domain event");
    expect(html).toContain("exercise:04");

    expectAuthoredOutline(parseStaticMarkup(html), [
      "依頼とレビューの責任を分ける",
      "エージェントへの依頼を組み立てる",
      "ブラウザで試す",
      "人が要求からレビューする",
      "完了条件と統合演習への橋渡し",
    ]);
  });
});
