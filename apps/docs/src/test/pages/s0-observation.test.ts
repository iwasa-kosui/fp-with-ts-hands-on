import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createAstroContainer } from "../render-astro";

const pagePath = resolve(
  process.cwd(),
  "src/pages/sessions/00-system-handover.astro",
);

const forbiddenSolutionTerms = [
  "型",
  "設計課題",
  "判別共用体",
  "Branded Type",
  "Zod",
  "Result",
  "Sensitive",
  "assertNever",
  "ResultAsync",
  "andThen",
  "andThrough",
  "イベント",
  "技法",
] as const;
const forbiddenSolutionWords = [/\bport\b/i, /\bevent\b/i] as const;

describe("S0 observation contract", () => {
  it("renders only current operations, stored or logged data, and known incidents", async () => {
    const source = await readFile(pagePath, "utf8");

    expect(source).not.toContain("SessionCodeOverview");
    expect(source).not.toContain("code-explorer");
    expect(source).not.toContain("guides");

    const { default: Page } = await import(
      "../../pages/sessions/00-system-handover.astro"
    );
    const container = await createAstroContainer();
    const html = await container.renderToString(Page, { partial: false });
    const document = new DOMParser().parseFromString(html, "text/html");
    const text = [
      document.querySelector(".case-file__hero")?.textContent,
      document.querySelector(".case-file__content")?.textContent,
    ].join(" ");

    for (const currentFact of [
      "受付",
      "獣医師",
      "飼い主",
      "診察開始",
      "予約データ",
      "カルテ",
      "会計データ",
      "調査ログ",
      "二重請求",
      "連絡先の流出",
    ]) {
      expect(text).toContain(currentFact);
    }
    expect(document.querySelector(".session-code-overview")).toBeNull();
    expect(document.querySelector("[data-code-explorer]")).toBeNull();
    expect(document.body.textContent).not.toContain("配布コード");

    for (const term of forbiddenSolutionTerms) {
      expect(source).not.toContain(term);
      expect(text).not.toContain(term);
    }
    for (const word of forbiddenSolutionWords) {
      expect(source).not.toMatch(word);
      expect(text).not.toMatch(word);
    }
  });
});
