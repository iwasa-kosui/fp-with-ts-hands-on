import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const exercises = [
  "invariants",
  "state-vocabulary",
  "state-transitions",
  "awaiting-payment",
  "cancellation",
  "input-boundary",
  "meaningful-values",
  "pii-output",
  "typed-failures",
  "success-events",
  "use-case-ports",
  "atomicity-and-conflicts",
  "safe-follow-up",
] as const;

const exerciseFiles = [
  "state-modeling.test.ts",
  "state-vocabulary.test.ts",
  "state-transitions.test.ts",
  "awaiting-payment.test.ts",
  "cancellation.test.ts",
  "input-boundary.test.ts",
  "value-meaning.test.ts",
  "pii-redaction.test.ts",
  "typed-failures.test.ts",
  "success-events.test.ts",
  "use-case-ports.test.ts",
  "atomicity-and-conflicts.test.ts",
  "safe-follow-up.test.ts",
] as const;

const pagePath = (slug: string): string =>
  resolve(`src/pages/sessions/${slug}.astro`);

const readPage = (slug: string): string => {
  const path = pagePath(slug);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
};

describe("Sessions 01 through 13", () => {
  it.each(exercises.map((slug, index) => [index + 1, slug] as const))(
    "authors Session %s at its canonical slug",
    (sequence, slug) => {
      const canonicalSlug = `${String(sequence).padStart(2, "0")}-${slug}`;
      expect(existsSync(pagePath(canonicalSlug))).toBe(true);
    },
  );

  it.each(exercises.map((slug, index) => [index + 1, slug] as const))(
    "keeps Session %s inside the shared learning contract",
    (sequence, slug) => {
      const number = String(sequence).padStart(2, "0");
      const page = readPage(`${number}-${slug}`);

      expect(page).toContain("SessionLayout");
      expect(page).toContain("sessionBySlug");
      expect(page).toContain("CommandBlock");
      expect(page).toContain("SessionCodePlayground");
      expect(page).toContain(`pnpm exercise:${number}`);
      expect(page).toContain(`examples/session-${number}/exercises/${exerciseFiles[sequence - 1]}`);
      expect(page).toContain("最大2関数");
      expect(page).toContain("この技法の限界");
      expect(page).toContain("型で守ること");
      expect(page).toContain("統合テストで守ること");
      expect(page).toContain("人がレビューすること");
      expect(page).toContain("振り返り");
    },
  );

  it("teaches atomicity with the exact shared verification language", () => {
    const page = readPage("12-atomicity-and-conflicts");

    expect(page).toContain("pnpm exercise:12");
    expect(page).toContain("型で守ること");
    expect(page).toContain("統合テストで守ること");
    expect(page).toContain("人がレビューすること");
    expect(page).toContain("examples/session-12/exercises/atomicity-and-conflicts.test.ts");
  });

  it.each([
    ["04-awaiting-payment", "診察完了と支払完了を混同しない。"],
    ["10-success-events", "失敗を業務イベントとして記録しない。"],
    ["12-atomicity-and-conflicts", "現在状態と監査イベントを別々に確定しない。"],
    [
      "13-safe-follow-up",
      "PII を含む連絡対象を監査 event に入れず、許可されない操作者へ返さない。",
    ],
  ])("uses the exact invariant on %s", (slug, invariant) => {
    expect(readPage(slug)).toContain(invariant);
  });

});
