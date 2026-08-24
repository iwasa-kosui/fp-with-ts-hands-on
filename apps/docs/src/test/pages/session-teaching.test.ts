import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { sessionBySlug } from "../../sessions/catalog";
import { renderSessionPage } from "./session-test-helpers";

// vitest は apps/docs を作業ディレクトリにして起動する。
const repositoryRoot = resolve(process.cwd(), "../..");

const readSource = (path: string): string =>
  readFileSync(resolve(repositoryRoot, path), "utf8");

// 引用は行の削除だけで切り詰める。整形し直すとこの照合が通らなくなる。
const quotedLines = (code: string): readonly string[] =>
  code
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("//"));

type RenderedCode = Readonly<{
  sources: readonly string[];
  lines: readonly string[];
}>;

const readFigure = (figure: Element): RenderedCode => ({
  sources: [...figure.querySelectorAll("figcaption code")].map(
    ({ textContent }) => textContent ?? "",
  ),
  lines: quotedLines(figure.querySelector("pre code")?.textContent ?? ""),
});

const teachingSessions = [
  sessionBySlug("03-semantic-identifiers")!,
  sessionBySlug("04-boundaries-and-pii")!,
];

describe.each(teachingSessions)("$slug teaching section", (session) => {
  it("shows the teach minutes and one topic per catalog decision", async () => {
    const document = await renderSessionPage(session);
    const teach = document.querySelector("#teach");
    const topics = [...document.querySelectorAll(".teaching-topic")];

    expect(teach?.querySelector("h2")?.textContent).toContain(
      `${session.timeBreakdown.teach}分`,
    );
    expect(topics).toHaveLength(session.decisions.length);
    for (const topic of topics) {
      expect(topic.querySelector("h3")?.textContent?.trim()).not.toBe("");
    }
  });

  it("quotes before and after from the example snapshots verbatim", async () => {
    const document = await renderSessionPage(session);
    const diffs = [...document.querySelectorAll(".teaching-topic__diff")];

    expect(diffs).toHaveLength(session.decisions.length);
    for (const diff of diffs) {
      const figures = [...diff.querySelectorAll("figure.code-block")];
      expect(figures).toHaveLength(2);
      expect(figures[0]?.querySelector("figcaption")?.textContent).toContain("before");
      expect(figures[1]?.querySelector("figcaption")?.textContent).toContain("after");

      for (const figure of figures) {
        const { sources, lines } = readFigure(figure);
        const caption = figure.querySelector("figcaption")?.textContent ?? "";
        expect(sources.length).toBeGreaterThan(0);
        for (const [index, source] of sources.entries()) {
          const next = sources[index + 1];
          if (next !== undefined) {
            expect(caption).not.toContain(`${source}${next}`);
          }
        }
        expect(lines.length).toBeGreaterThan(0);
        const bodies = sources.map(readSource);
        for (const line of lines) {
          expect(
            bodies.some((body) =>
              body.split("\n").some((sourceLine) => sourceLine.trim() === line),
            ),
            `${line} が ${sources.join(", ")} に見つかりません`,
          ).toBe(true);
        }
      }
    }
  });
});

describe("S4 teaching section", () => {
  const session = sessionBySlug("04-boundaries-and-pii")!;

  it("defers the Result branching to S5", async () => {
    const document = await renderSessionPage(session);
    const teach = document.querySelector("#teach")?.textContent ?? "";

    expect(teach).toContain("S5");
    expect(teach).not.toContain("andThen(");
    expect(teach).not.toContain("isOk");
    expect(teach).not.toContain("isErr");
  });
});
