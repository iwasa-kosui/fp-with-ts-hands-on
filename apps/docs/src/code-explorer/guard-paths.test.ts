import { describe, expect, it } from "vitest";
import {
  casePathFor,
  guardCommandFor,
  guardAnswerDisplayFiles,
  guardAnswerFiles,
  guardInitialFile,
  guardVisibleFiles,
  isGuardReadOnlyPath,
  readGuardCases,
} from "./guard-paths";
import { projectFilesForSnapshot } from "./project-files";

const files = {
  "package.json": "{}",
  "eslint.config.mjs": "export default [];",
  "exercises/guard/mine/input.test.ts": "",
  "exercises/guard/cases/B1-any.ts": "",
  "exercises/guard/cases/G1-ok/index.ts": "",
  "exercises/guard/subjects/input.ts": "",
  "exercises/guard/answer/eslint.config.mjs": "",
  "src/app.ts": "",
};

describe("guard command", () => {
  it("adds --columns and uses the terminal size when the size is known", () => {
    expect(guardCommandFor({ cols: 58, rows: 20 })).toEqual({
      command: "node",
      args: ["vendor/exercise-guard/cli.mjs", "--columns", "58"],
      size: { cols: 58, rows: 20 },
    });
  });

  it("uses 58 columns and the default size when the size is unknown", () => {
    expect(guardCommandFor(undefined)).toEqual({
      command: "node",
      args: ["vendor/exercise-guard/cli.mjs", "--columns", "58"],
      size: { cols: 80, rows: 24 },
    });
  });
});

describe("guard exercise paths", () => {
  it("shows the lint config, mine, cases, and subjects only", () => {
    expect(guardVisibleFiles(files)).toEqual([
      "eslint.config.mjs",
      "exercises/guard/mine/input.test.ts",
      "exercises/guard/cases/B1-any.ts",
      "exercises/guard/cases/G1-ok/index.ts",
      "exercises/guard/subjects/input.ts",
    ]);
  });

  it("opens the lint config first and falls back to a visible file", () => {
    expect(guardInitialFile(guardVisibleFiles(files))).toBe("eslint.config.mjs");
    expect(guardInitialFile(["exercises/guard/cases/B1-any.ts"])).toBe(
      "exercises/guard/cases/B1-any.ts",
    );
  });

  it("makes cases and subjects read-only and leaves mine and the lint config editable", () => {
    expect(isGuardReadOnlyPath("exercises/guard/cases/B1-any.ts")).toBe(true);
    expect(isGuardReadOnlyPath("exercises/guard/subjects/input.ts")).toBe(true);
    expect(isGuardReadOnlyPath("exercises/guard/mine/input.test.ts")).toBe(false);
    expect(isGuardReadOnlyPath("exercises/guard/cases/R1-peer-change.ts")).toBe(
      false,
    );
    expect(isGuardReadOnlyPath("eslint.config.mjs")).toBe(false);
  });

  it("finds the file of a case by its id", () => {
    const paths = Object.keys(files);

    expect(casePathFor(paths, "B1-any")).toBe("exercises/guard/cases/B1-any.ts");
    expect(casePathFor(paths, "G1-ok")).toBe(
      "exercises/guard/cases/G1-ok/index.ts",
    );
    expect(casePathFor(paths, "missing")).toBeUndefined();
  });

  it("collects the answer files", () => {
    expect(Object.keys(guardAnswerFiles(files))).toEqual([
      "exercises/guard/answer/eslint.config.mjs",
    ]);
  });

  it("shows the answer files under the names where the participant puts them", () => {
    const shown = guardAnswerDisplayFiles({
      "exercises/guard/answer/eslint.config.mjs": "export default [];",
      "exercises/guard/answer/mine/audit.test.ts": [
        'import { OwnerId } from "../../../../src/domain/owner/index.js";',
        'import { toAuditPayload } from "../../subjects/audit.js";',
      ].join("\n"),
      "exercises/guard/mine/input.test.ts": "",
    });

    expect(shown).toEqual({
      "eslint.config.mjs": "export default [];",
      "exercises/guard/mine/audit.test.ts": [
        'import { OwnerId } from "../../../src/domain/owner/index.js";',
        'import { toAuditPayload } from "../subjects/audit.js";',
      ].join("\n"),
    });
  });

  it("omits the answer files that match the file the participant starts with", () => {
    const shown = guardAnswerDisplayFiles({
      "exercises/guard/answer/mine/states.ts": "export const states = [];",
      "exercises/guard/answer/mine/audit.test.ts": "changed",
      "exercises/guard/answer/mine/new.test.ts": "no starting file",
      "exercises/guard/mine/states.ts": "export const states = [];",
      "exercises/guard/mine/audit.test.ts": "",
    });

    expect(shown).toEqual({
      "exercises/guard/mine/audit.test.ts": "changed",
      "exercises/guard/mine/new.test.ts": "no starting file",
    });
  });

  it("reads the cases from the config", () => {
    const cases = readGuardCases({
      ...files,
      "exercises/guard/guard.config.mjs": `export default {
  subjects: {},
  cases: [
    { id: "B1-any", kind: "bad", title: "any を使う", stage: 2, required: false },
    { id: "G1-ok", kind: "good", title: "正しい" },
  ],
};
`,
    });

    expect(cases).toEqual([
      {
        id: "B1-any",
        kind: "bad",
        title: "any を使う",
        stage: 2,
        required: false,
        path: "exercises/guard/cases/B1-any.ts",
      },
      {
        id: "G1-ok",
        kind: "good",
        title: "正しい",
        stage: 1,
        required: true,
        path: "exercises/guard/cases/G1-ok/index.ts",
      },
    ]);
  });

  it("reads behavior from the config and drops one with a wrong shape", () => {
    const cases = readGuardCases({
      ...files,
      "exercises/guard/guard.config.mjs": `export default {
  subjects: {},
  cases: [
    {
      id: "B1-any",
      kind: "bad",
      title: "any を使う",
      behavior: {
        input: { text: "年齢", value: "20" },
        expected: { text: "受け付ける" },
        actual: { text: "拒否する", value: "error" },
      },
    },
    { id: "G1-ok", kind: "good", title: "正しい", behavior: { input: { text: "x" } } },
  ],
};
`,
    });

    expect(cases[0]?.behavior).toEqual({
      input: { text: "年齢", value: "20" },
      expected: { text: "受け付ける" },
      actual: { text: "拒否する", value: "error" },
    });
    expect(cases[1]).not.toHaveProperty("behavior");
  });

  it("falls back to the case file names when the config cannot be read", () => {
    const cases = readGuardCases({
      ...files,
      "exercises/guard/guard.config.mjs": "import x from 'y'; export default x;",
    });

    expect(cases.map(({ id, kind, title }) => [id, kind, title])).toEqual([
      ["B1-any", "bad", "B1-any"],
      ["G1-ok", "good", "G1-ok"],
    ]);
  });

  it("reads every case of the session-03-solution snapshot", () => {
    const snapshot = projectFilesForSnapshot("session-03-solution");
    const cases = readGuardCases(snapshot);

    expect(cases.length).toBeGreaterThan(0);
    expect(cases.filter(({ path }) => path === undefined)).toEqual([]);
    expect(cases.some(({ kind }) => kind === "bad")).toBe(true);
  });
});
