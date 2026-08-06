import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import StateModelingPage from "../../../pages/sessions/01-state-modeling.astro";
import BoundaryAndIdsPage from "../../../pages/sessions/02-boundary-and-ids.astro";
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
  expect(tocLinks.length).toBe(chapters.length * 2);
  expect(tocLinks.every((link) => link.id === "")).toBe(true);

  const tocHrefs = [
    ...new Set(tocLinks.map((link) => link.getAttribute("href"))),
  ];
  expect(tocHrefs).toHaveLength(chapters.length);

  for (const href of tocHrefs) {
    expect(href).toMatch(/^#[a-z0-9-]+$/);
    expect(document.querySelectorAll(`article h2${href}`)).toHaveLength(1);
  }
};

describe("Sessions 01 and 02", () => {
  it("uses each session's starting snapshot and verification command", () => {
    const stateModeling = readPage("01-state-modeling");
    const boundaryAndIds = readPage("02-boundary-and-ids");

    expect(stateModeling).toContain("examples/session-01");
    expect(stateModeling).toContain('command="pnpm exercise:01"');
    expect(stateModeling).toContain(
      'command="pnpm --filter @fp-with-ts/clinic-session-01 test"',
    );
    expect(boundaryAndIds).toContain(
      "examples/session-02/src/domain/appointment.ts",
    );
    expect(boundaryAndIds).toContain('command="pnpm exercise:02"');
    expect(boundaryAndIds).toContain(
      'command="pnpm --filter @fp-with-ts/clinic-session-02 test"',
    );
    expect(stateModeling).not.toContain("packages/clinic-example");
    expect(boundaryAndIds).not.toContain("packages/clinic-example");
  });

  it("teaches state and data as one discriminated union", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(StateModelingPage, {
      partial: false,
    });

    expect(html).toContain(
      "Scheduled -&gt; CheckedIn -&gt; InExamination -&gt; Paid",
    );
    expect(html).toContain("Discriminated Union");
    expect(html).toContain("Appointment.startExamination");
    expect(html).toContain("Appointment.cancelWithReason");
    expect(html).toContain("exercise:01");

    expectAuthoredOutline(parseStaticMarkup(html), [
      "要求と状態遷移を整理する",
      "失敗から編集箇所を読む",
      "状態とデータを同時に閉じる",
      "レビューと次の境界へ",
    ]);
  });

  it("separates input validation, branded IDs, and PII protection", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(BoundaryAndIdsPage, {
      partial: false,
    });

    expect(html).toContain("unknown は parse してから使い");
    expect(html).toContain("Branded Type");
    expect(html).toContain("Sensitive");
    expect(html).toContain("[REDACTED]");
    expect(html).toContain("exercise:02");

    expectAuthoredOutline(parseStaticMarkup(html), [
      "事故を3つの境界へ分ける",
      "失敗から変換境界を読む",
      "入力・ID・PIIを別々に守る",
      "レビューと次のエラー設計へ",
    ]);
  });
});
