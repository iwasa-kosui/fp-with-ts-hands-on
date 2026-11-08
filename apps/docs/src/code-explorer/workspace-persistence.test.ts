import { describe, expect, it } from "vitest";
import {
  applyAllSavedEdits,
  applySavedEdits,
  computeEdits,
  trimTerminalOutput,
} from "./workspace-persistence";

const projectFiles = {
  "src/a.ts": "const a = 1;",
  "src/b.ts": "const b = 1;",
};

describe("computeEdits", () => {
  it("records changed files with the original code as their base", () => {
    expect(
      computeEdits({ ...projectFiles, "src/a.ts": "const a = 2;" }, projectFiles),
    ).toEqual({
      "src/a.ts": { contents: "const a = 2;", base: "const a = 1;" },
    });
  });

  it("records a deleted file with null contents", () => {
    expect(computeEdits({ "src/a.ts": projectFiles["src/a.ts"] }, projectFiles)).toEqual({
      "src/b.ts": { contents: null, base: "const b = 1;" },
    });
  });

  it("records a new file with a null base", () => {
    expect(
      computeEdits({ ...projectFiles, "src/c.ts": "const c = 1;" }, projectFiles),
    ).toEqual({
      "src/c.ts": { contents: "const c = 1;", base: null },
    });
  });

  it("returns no edits when nothing changed", () => {
    expect(computeEdits({ ...projectFiles }, projectFiles)).toEqual({});
  });
});

describe("applySavedEdits", () => {
  const visiblePaths = ["src/a.ts", "src/b.ts"];

  it("applies edits, deletions, and new files", () => {
    const result = applySavedEdits(projectFiles, visiblePaths, {
      "src/a.ts": { contents: "const a = 2;", base: "const a = 1;" },
      "src/b.ts": { contents: null, base: "const b = 1;" },
      "src/c.ts": { contents: "const c = 1;", base: null },
    });

    expect(result.contents).toEqual({
      "src/a.ts": "const a = 2;",
      "src/c.ts": "const c = 1;",
    });
    expect(result.visiblePaths).toEqual(["src/a.ts", "src/c.ts"]);
    expect(result.outdatedPaths).toEqual([]);
  });

  it("skips edits whose base differs from the current code", () => {
    const edits = {
      "src/a.ts": { contents: "const a = 2;", base: "const a = 0;" },
      "src/b.ts": { contents: "const b = 2;", base: "const b = 1;" },
      "src/c.ts": { contents: "const c = 1;", base: "export {};" },
    };

    const result = applySavedEdits(projectFiles, visiblePaths, edits);

    expect(result.outdatedPaths).toEqual(["src/a.ts", "src/c.ts"]);
    expect(result.contents).toEqual({
      "src/a.ts": "const a = 1;",
      "src/b.ts": "const b = 2;",
    });
    expect(result.visiblePaths).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("applies outdated edits too when asked to use all saved edits", () => {
    const result = applyAllSavedEdits(projectFiles, visiblePaths, {
      "src/a.ts": { contents: "const a = 2;", base: "const a = 0;" },
    });

    expect(result.contents["src/a.ts"]).toBe("const a = 2;");
    expect(result.outdatedPaths).toEqual(["src/a.ts"]);
  });
});

describe("trimTerminalOutput", () => {
  it("keeps output at or under the limit", () => {
    expect(trimTerminalOutput("a\nb", 3)).toBe("a\nb");
    expect(trimTerminalOutput("short")).toBe("short");
  });

  it("keeps the tail starting after the first line break", () => {
    expect(trimTerminalOutput("xxxx\nline2\nline3", 8)).toBe("line3");
    expect(trimTerminalOutput("ab\ncdef\ngh", 6)).toBe("gh");
  });

  it("limits long output to the default size", () => {
    const output = `${"x".repeat(150_000)}\n${"y".repeat(100_000)}`;

    expect(trimTerminalOutput(output)).toBe("y".repeat(100_000));
  });
});
