import { describe, expect, it } from "vitest";
import type { SolutionReference } from "./types";
import { loadSolutionSnippets } from "./solution-snippets";

const solution: SolutionReference = {
  path: "examples/session-01-solution/src/domain/appointment/transitions.ts",
  symbol: "startExamination",
  lines: [16, 26],
};

describe("loadSolutionSnippets", () => {
  it("reads non-empty code from the requested source lines", async () => {
    const snippets = await loadSolutionSnippets({ solutions: [solution] });

    expect(snippets).toHaveLength(1);
    expect(snippets[0]?.code.trim()).not.toBe("");
    expect(snippets[0]?.code).toContain("startExamination");
  });

  it("rejects source lines outside the file", async () => {
    await expect(
      loadSolutionSnippets({
        solutions: [{ ...solution, lines: [1, Number.MAX_SAFE_INTEGER] }],
      }),
    ).rejects.toThrow("指定行がソースの範囲外です");
  });
});
