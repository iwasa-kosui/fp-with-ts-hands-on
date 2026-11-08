import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { classifyLint, runLint } from "../src/lint.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "fixtures", "s03");
const casesDir = path.join(root, "exercises/guard/cases");
const eslintConfigFile = path.join(here, "fixtures", "s03-scenarios", "pass", "eslint.config.mjs");

const caseFiles = Object.fromEntries(
  readdirSync(casesDir).map((name) => [name.replace(/\.ts$/, ""), path.join(casesDir, name)]),
);

/**
 * @param {readonly string[]} ids
 * @returns {ts.Program}
 */
const programOf = (ids) => {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    path.join(root, "tsconfig.json"),
    {},
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined },
  );
  return ts.createProgram({
    rootNames: ids.map((id) => caseFiles[id] ?? ""),
    options: parsed?.options ?? {},
  });
};

/**
 * @param {ts.Program} program
 */
const lintWith = (program) =>
  runLint({ root, eslintConfigFile, patterns: ["exercises/guard/cases/**/*.ts"], caseFiles, program });

describe("runLint with a shared program", () => {
  it("参加者の eslint.config.mjs の rules を、共有した program のままで評価する", async () => {
    const run = await lintWith(programOf(Object.keys(caseFiles)));
    const classified = classifyLint(run.results, { root, casesDir, caseFiles });

    expect(classified.problems).toEqual([]);
    expect(classified.byCase["B1-any-parser"]?.some((detection) => detection.label === "@typescript-eslint/no-explicit-any")).toBe(true);
    expect(classified.byCase["G1-solution"]).toBeUndefined();
  });

  it("program に入っていないケースは fatal として拾い、合格にしない", async () => {
    const ids = Object.keys(caseFiles).filter((id) => id !== "B3-schema-without-uuid");
    const run = await lintWith(programOf(ids));
    const classified = classifyLint(run.results, { root, casesDir, caseFiles });

    expect(classified.problems).toHaveLength(1);
    expect(classified.problems[0]?.message).toContain("exercises/guard/cases/B3-schema-without-uuid.ts");
    expect(classified.problems[0]?.fix).toBe("Linter が読み込めないファイルを直します。");
  });
});
