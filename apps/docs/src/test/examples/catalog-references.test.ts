import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  type ExerciseStep,
  type SolutionReference,
  sessions,
} from "../../sessions/catalog";

const repoRoot = resolve(process.cwd(), "../..");
const exerciseSessions = sessions.filter(
  (session) => session.kind === "exercise",
);
const nextSnapshot = {
  "session-02": "session-03",
  "session-03": "session-04",
  "session-04": "session-05",
  "session-05": "session-06",
} as const;

const solutionsFor = (
  steps: readonly ExerciseStep[],
): readonly SolutionReference[] =>
  steps.flatMap(({ solutions }) => solutions);

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

const runExercise = async (snapshot: string): Promise<ExerciseReport> =>
  new Promise((resolveResult, reject) => {
    execFile(
      "pnpm",
      [
        "--filter",
        `@fp-with-ts/clinic-${snapshot}`,
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
          reject(new Error(`${snapshot} exercise unexpectedly passed`));
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
        ...(session.steps ?? []).flatMap(({ solutions }) =>
          solutions.map(({ path }) => path),
        ),
        ...(session.finalReferences ?? []),
      ]) {
        await expect(
          access(resolve(repoRoot, referencedPath)),
        ).resolves.toBeUndefined();
      }

      if (session.kind !== "exercise") continue;
      for (const { solutions } of session.steps) {
        for (const solution of solutions) {
          expect(solution.path).toMatch(
            new RegExp(`^examples/${nextSnapshot[session.snapshot]}/src/`),
          );
          const source = await readFile(
            resolve(repoRoot, solution.path),
            "utf8",
          );
          const sourceFile = ts.createSourceFile(
            solution.path,
            source,
            ts.ScriptTarget.Latest,
            true,
          );
          const declaration = sourceFile.statements.find((statement) =>
            declaredNames(statement).includes(solution.symbol),
          );
          expect(
            declaration,
            `${solution.path}: ${solution.symbol}`,
          ).toBeDefined();
          if (declaration === undefined) continue;

          const [start, end] = solution.lines;
          expect(start).toBeGreaterThanOrEqual(1);
          expect(end).toBeGreaterThanOrEqual(start);
          const declarationStart =
            sourceFile.getLineAndCharacterOfPosition(
              declaration.getStart(sourceFile),
            ).line + 1;
          const declarationEnd =
            sourceFile.getLineAndCharacterOfPosition(declaration.end).line + 1;
          expect(start).toBeLessThanOrEqual(declarationStart);
          expect(end).toBeGreaterThanOrEqual(declarationEnd);
        }
      }
    }
  });

  it("12. resolves packages for public snapshots without requiring one for S1", async () => {
    const s1 = sessions.find(
      ({ slug }) => slug === "01-business-events-and-workflows",
    );
    expect(s1?.kind).toBe("workshop");
    expect(s1?.snapshot).toBeUndefined();
    await expect(
      access(resolve(repoRoot, "examples/session-01/package.json")),
    ).rejects.toMatchObject({ code: "ENOENT" });

    for (const session of sessions) {
      if (session.snapshot === undefined) continue;
      await expect(
        access(resolve(repoRoot, `examples/${session.snapshot}/package.json`)),
      ).resolves.toBeUndefined();
    }
  });

  it("covers every target with a solution at the same relative path in the next snapshot", () => {
    for (const session of exerciseSessions) {
      const solutionSnapshot = nextSnapshot[session.snapshot];
      for (const step of session.steps) {
        const solutionPaths = step.solutions.map(({ path }) => path);
        for (const target of step.targets) {
          const relativePath = target.slice(`examples/${session.snapshot}/`.length);
          expect(solutionPaths, `${session.slug}: ${step.id}: ${relativePath}`).toContain(
            `examples/${solutionSnapshot}/${relativePath}`,
          );
        }
      }
    }
  });

  it("keeps S2-S4 as excerpt defaults and presents every S5 target from session-06 as a completed file", async () => {
    for (const session of exerciseSessions.slice(0, 3)) {
      for (const solution of solutionsFor(session.steps)) {
        expect(solution.presentation ?? "excerpt").toBe("excerpt");
      }
    }

    const s5 = sessions.find(
      ({ slug }) => slug === "05-effects-and-consistency",
    );
    expect(s5?.kind).toBe("exercise");
    if (s5?.kind !== "exercise") throw new Error("S5 exercise is missing");

    const s5Steps: readonly ExerciseStep[] = s5.steps;
    for (const step of s5Steps) {
      const expectedPaths = step.targets.map((target) =>
        target.replace("examples/session-05/", "examples/session-06/"),
      );
      expect(step.solutions.map(({ path }) => path), step.id).toEqual(expectedPaths);
      for (const solution of step.solutions) {
        const source = await readFile(resolve(repoRoot, solution.path), "utf8");
        const lineCount = source.endsWith("\n")
          ? source.split("\n").length - 1
          : source.split("\n").length;
        expect(solution.presentation, solution.path).toBe("completed-file");
        expect(solution.lines, solution.path).toEqual([1, lineCount]);
      }
    }
  });

  it("labels starter assertions outside catalog steps as regression checks", async () => {
    const files = [
      "examples/session-03/exercises/boundary-and-ids.test.ts",
      "examples/session-04/test/regression/boundary-and-ids.test.ts",
      "examples/session-04/exercises/result-errors.test.ts",
    ];
    for (const file of files) {
      const source = await readFile(resolve(repoRoot, file), "utf8");
      expect(source).not.toMatch(
        /describe\("Step [34]: (schema|異なる種類|失敗後)/,
      );
      expect(source).toContain('describe("回帰条件:');
    }
  });

  it("maps every catalog step one-to-one to an AssertionError RED in its starter", async () => {
    const expectedExercises = [
      {
        slug: "02-state-transitions",
        steps: [
          {
            id: "s2-narrow-start",
            group: "Step 1: 会計済みの来院は診察を開始できない",
            assertion: "Paid を渡す呼び出しはコンパイルできない",
          },
          {
            id: "s2-require-cancel-reason",
            group: "Step 2: キャンセルには必ず理由を残す",
            assertion: "reason を省いた呼び出しはコンパイルできない",
          },
          {
            id: "s2-align-transitions",
            group: "Step 3: 全遷移の入口を状態型で絞る",
            assertion: "許可されない遷移元はコンパイルできない",
          },
          {
            id: "s2-exhaustive-label",
            group: "Step 4: 状態追加時に表示分岐を見直す",
            assertion: "6つ目の状態を足すと status label がコンパイルできない",
          },
        ],
      },
      {
        slug: "03-boundaries-and-semantic-values",
        steps: [
          {
            id: "s3-parse-exam-result",
            group: "Step 1: 形の違う検査 JSON はドメイン型にならない",
            assertion: "petId がない JSON は err になる",
          },
          {
            id: "s3-protect-contact",
            group: "Step 2: 電話番号とメールはログへ出ない",
            assertion: "JSON と util.inspect のどちらも値をマスクする",
          },
        ],
      },
      {
        slug: "04-workflow-errors",
        steps: [
          {
            id: "s4-invalid-state",
            group: "Step 1: InvalidAppointmentState を値として返す",
            assertion: "CheckedIn でない予約でも例外を投げない",
          },
          {
            id: "s4-not-found",
            group: "Step 2: AppointmentNotFound を値として返す",
            assertion: "予約が見つからなくても例外を投げない",
          },
          {
            id: "s4-result-pipeline",
            group: "Step 3: andThen pipeline が失敗理由を運ぶ",
            assertion: "予約なしを InvalidAppointmentState に潰さない",
          },
        ],
      },
      {
        slug: "05-effects-and-consistency",
        steps: [
          {
            id: "s5-inject-context",
            group: "Step 1: 同じ clock と ID generator なら同じイベントになる",
            assertion: "固定 context から同じ eventId と occurredAt を返す",
          },
          {
            id: "s5-atomic-store",
            group: "Step 2: 状態と監査記録は1回の保存で残る",
            assertion: "store(event) を1回だけ呼ぶ",
          },
          {
            id: "s5-result-async",
            group: "Step 3: 非同期保存後もイベントが pipeline に残る",
            assertion:
              "保存成功時は store の void ではなく aggregateState を返す",
          },
          {
            id: "s5-propagate-store-failure",
            group: "Step 4: 保存失敗時は状態も記録も残らない",
            assertion: "cause と PII のない RepositoryError を返し in-memory state を変更しない",
          },
        ],
      },
    ] as const;

    const exercises = expectedExercises.map((expected) => {
      const session = sessions.find(({ slug }) => slug === expected.slug);
      expect(session?.kind).toBe("exercise");
      if (session?.kind !== "exercise")
        throw new Error(`${expected.slug} is not an exercise`);
      return { expected, session };
    });
    const reports = await Promise.all(
      exercises.map(({ session }) => runExercise(session.snapshot)),
    );

    for (const [{ expected, session }, report] of exercises.map(
      (exercise, index) => [exercise, reports[index]] as const,
    )) {
      expect(session.steps.map(({ id }) => id)).toEqual(
        expected.steps.map(({ id }) => id),
      );
      expect(report.success).toBe(false);
      expect(report.numFailedTests).toBe(session.steps.length);
      const failingAssertions = report.testResults
        .flatMap(({ assertionResults }) => assertionResults)
        .filter(({ status }) => status === "failed");
      expect(failingAssertions).toHaveLength(session.steps.length);
      expect(
        failingAssertions.map(({ ancestorTitles, title }) => ({
          group: ancestorTitles.at(-1),
          assertion: title,
        })),
      ).toEqual(
        expected.steps.map(({ group, assertion }) => ({ group, assertion })),
      );
      for (const { failureMessages } of failingAssertions) {
        expect(failureMessages).toBeDefined();
        expect(failureMessages.length).toBeGreaterThan(0);
        expect(
          failureMessages.every((message) =>
            message.startsWith("AssertionError:"),
          ),
        ).toBe(true);
      }
    }
  }, 30_000);
});
