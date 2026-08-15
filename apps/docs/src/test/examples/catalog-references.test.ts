import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { sessions } from "../../sessions/catalog";

const repoRoot = resolve(process.cwd(), "../..");
const exerciseSessions = sessions.filter((session) => session.kind === "exercise");
const nextSnapshot = {
  "session-01": "session-02",
  "session-02": "session-03",
  "session-03": "session-04",
  "session-04": "session-05",
} as const;

type ExerciseResult = Readonly<{
  assertionResults: readonly Readonly<{
    ancestorTitles: readonly string[];
    failureMessages: readonly string[];
    status: string;
    title: string;
  }>[];
}>;

type ExerciseReport = Readonly<{
  success: boolean;
  numFailedTests: number;
  testResults: readonly ExerciseResult[];
}>;

const runSession02Exercise = async (): Promise<ExerciseReport> =>
  new Promise((resolveResult, reject) => {
    execFile(
      "pnpm",
      [
        "--filter",
        "@fp-with-ts/clinic-session-02",
        "exec",
        "vitest",
        "run",
        "--config",
        "vitest.exercises.config.ts",
        "--reporter=json",
      ],
      { cwd: repoRoot, maxBuffer: 2_000_000 },
      (error, stdout) => {
        if (error === null) {
          reject(new Error("session-02 exercise unexpectedly passed"));
          return;
        }
        try {
          const [json] = stdout.split("\n", 1);
          resolveResult(JSON.parse(json) as ExerciseReport);
        } catch (cause) {
          reject(cause);
        }
      },
    );
  });

const declaredNames = (statement: ts.Statement): readonly string[] => {
  if (
    ts.isClassDeclaration(statement) ||
    ts.isEnumDeclaration(statement) ||
    ts.isFunctionDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement)
  ) {
    return statement.name === undefined ? [] : [statement.name.text];
  }
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.flatMap(({ name }) =>
      ts.isIdentifier(name) ? [name.text] : [],
    );
  }
  return [];
};

describe("session catalog references", () => {
  it("11. resolves targets, solutions, symbols, line ranges, and final references", async () => {
    expect(exerciseSessions).toHaveLength(4);
    for (const session of sessions) {
      for (const referencedPath of [
        ...(session.steps ?? []).flatMap(({ targets }) => targets),
        ...(session.steps ?? []).map(({ solution }) => solution.path),
        ...(session.finalReferences ?? []),
      ]) {
        await expect(access(resolve(repoRoot, referencedPath))).resolves.toBeUndefined();
      }

      if (session.kind !== "exercise") continue;
      for (const { solution } of session.steps) {
        expect(solution.path).toMatch(
          new RegExp(`^examples/${nextSnapshot[session.snapshot]}/src/`),
        );
        const source = await readFile(resolve(repoRoot, solution.path), "utf8");
        const sourceFile = ts.createSourceFile(
          solution.path,
          source,
          ts.ScriptTarget.Latest,
          true,
        );
        const declaration = sourceFile.statements.find((statement) =>
          declaredNames(statement).includes(solution.symbol),
        );
        expect(declaration, `${solution.path}: ${solution.symbol}`).toBeDefined();
        if (declaration === undefined) continue;

        const [start, end] = solution.lines;
        expect(start).toBeGreaterThanOrEqual(1);
        expect(end).toBeGreaterThanOrEqual(start);
        const declarationStart = sourceFile.getLineAndCharacterOfPosition(
          declaration.getStart(sourceFile),
        ).line + 1;
        const declarationEnd = sourceFile.getLineAndCharacterOfPosition(declaration.end).line + 1;
        expect(start).toBeLessThanOrEqual(declarationStart);
        expect(end).toBeGreaterThanOrEqual(declarationEnd);
      }
    }
  });

  it("12. resolves a package for every catalog snapshot", async () => {
    for (const { snapshot } of sessions) {
      await expect(
        access(resolve(repoRoot, `examples/${snapshot}/package.json`)),
      ).resolves.toBeUndefined();
    }
  });

  it("maps S2 catalog steps one-to-one to assertions that are RED in the starter", async () => {
    const session = sessions.find(({ slug }) => slug === "02-boundary-and-ids");
    expect(session?.kind).toBe("exercise");
    if (session?.kind !== "exercise") return;

    const expected = [
      {
        id: "s2-parse-exam-result",
        exercise: {
          group: "Step 1: 形の違う検査 JSON はドメイン型にならない",
          assertion: "petId がない JSON は err になる",
        },
      },
      {
        id: "s2-protect-contact",
        exercise: {
          group: "Step 2: 電話番号とメールはログへ出ない",
          assertion: "JSON と util.inspect のどちらも値をマスクする",
        },
      },
    ] as const;

    expect(session.steps.map(({ id }) => id)).toEqual(expected.map(({ id }) => id));
    const exerciseResult = await runSession02Exercise();
    expect(exerciseResult.success).toBe(false);
    expect(exerciseResult.numFailedTests).toBe(2);
    const failingAssertions = exerciseResult.testResults
      .flatMap(({ assertionResults }) => assertionResults)
      .filter(({ status }) => status === "failed");
    expect(failingAssertions).toHaveLength(2);
    expect(
      failingAssertions.map(({ ancestorTitles, title }) => ({
        group: ancestorTitles.at(-1),
        assertion: title,
      })),
    ).toEqual(expected.map(({ exercise }) => exercise));
    for (const { failureMessages } of failingAssertions) {
      expect(failureMessages).toBeDefined();
      expect(failureMessages.length).toBeGreaterThan(0);
      expect(failureMessages.every((message) => message.startsWith("AssertionError:"))).toBe(true);
    }
  }, 10_000);

  it("keeps the S3 no-effects step scoped to the implementation changed for GREEN", () => {
    const session = sessions.find(({ slug }) => slug === "03-result-errors");
    const step = session?.steps.find(({ id }) => id === "s3-no-effects-after-failure");
    expect(step?.targets).toEqual([
      "examples/session-03/src/useCase/startExamination.ts",
    ]);
  });
});
