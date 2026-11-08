import { describe, expect, it } from "vitest";
import {
  casePathFor,
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

  it("reads every case of the session-05 snapshot", () => {
    const snapshot = projectFilesForSnapshot("session-05");
    const cases = readGuardCases(snapshot);

    expect(cases.length).toBeGreaterThan(0);
    expect(cases.filter(({ path }) => path === undefined)).toEqual([]);
    expect(cases.some(({ kind }) => kind === "bad")).toBe(true);
  });
});
