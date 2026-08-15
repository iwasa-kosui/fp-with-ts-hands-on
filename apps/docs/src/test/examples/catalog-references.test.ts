import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { sessions } from "../../sessions/catalog";

const repoRoot = resolve(process.cwd(), "../..");
const exerciseSessions = sessions.filter(
  (session) => session.kind === "exercise",
);
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

const readSolutionSlice = async (solution: {
  readonly path: string;
  readonly lines: readonly [number, number];
}): Promise<string> => {
  const source = await readFile(resolve(repoRoot, solution.path), "utf8");
  const [start, end] = solution.lines;
  return source
    .split("\n")
    .slice(start - 1, end)
    .join("\n");
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

  it("12. resolves a package for every catalog snapshot", async () => {
    for (const { snapshot } of sessions) {
      await expect(
        access(resolve(repoRoot, `examples/${snapshot}/package.json`)),
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

  it("keeps S4 snippets incremental and scoped to exact top-level declarations", async () => {
    const s4 = sessions.find(({ slug }) => slug === "04-effects-and-events");
    expect(s4?.kind).toBe("exercise");
    if (s4?.kind !== "exercise") throw new Error("S4 exercise is missing");

    const expectedSymbols: ReadonlyMap<string, readonly string[]> = new Map([
      ["s4-inject-context", ["EventContextDependencies", "createEventContext"]],
      ["s4-atomic-store", ["ExaminationStartedStore", "EffectsDependencies"]],
      ["s4-result-async", ["startExaminationWithEffects"]],
      [
        "s4-propagate-store-failure",
        [
          "RepositoryFailure",
          "RepositoryError",
          "StartExaminationWithEffectsError",
          "toRepositoryError",
          "storeExaminationStarted",
        ],
      ],
    ]);

    for (const step of s4.steps) {
      expect(step.solutions.map(({ symbol }) => symbol), step.id).toEqual(
        expectedSymbols.get(step.id),
      );
      for (const solution of step.solutions) {
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
        expect(solution.lines).toEqual([
          sourceFile.getLineAndCharacterOfPosition(
            declaration.getStart(sourceFile),
          ).line + 1,
          sourceFile.getLineAndCharacterOfPosition(declaration.end).line + 1,
        ]);
      }
    }

    const stepOne = s4.steps[0];
    const stepOneSource = (
      await Promise.all(stepOne.solutions.map(readSolutionSlice))
    ).join("\n");
    expect(stepOneSource).not.toContain("startExaminationWithEffects");
    expect(stepOneSource).not.toContain("andThrough");
    expect(stepOneSource).not.toContain("ExaminationStartedStore");
  });

  it("labels starter assertions outside catalog steps as regression checks", async () => {
    const files = [
      "examples/session-02/exercises/boundary-and-ids.test.ts",
      "examples/session-03/test/regression/boundary-and-ids.test.ts",
      "examples/session-03/exercises/result-errors.test.ts",
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
        slug: "01-state-modeling",
        steps: [
          {
            id: "s1-narrow-start",
            group: "Step 1: 会計済みの来院は診察を開始できない",
            assertion: "Paid を渡す呼び出しはコンパイルできない",
          },
          {
            id: "s1-require-cancel-reason",
            group: "Step 2: キャンセルには必ず理由を残す",
            assertion: "reason を省いた呼び出しはコンパイルできない",
          },
          {
            id: "s1-align-transitions",
            group: "Step 3: 全遷移の入口を状態型で絞る",
            assertion: "許可されない遷移元はコンパイルできない",
          },
          {
            id: "s1-exhaustive-label",
            group: "Step 4: 状態追加時に表示分岐を見直す",
            assertion: "6つ目の状態を足すと status label がコンパイルできない",
          },
        ],
      },
      {
        slug: "02-boundary-and-ids",
        steps: [
          {
            id: "s2-parse-exam-result",
            group: "Step 1: 形の違う検査 JSON はドメイン型にならない",
            assertion: "petId がない JSON は err になる",
          },
          {
            id: "s2-protect-contact",
            group: "Step 2: 電話番号とメールはログへ出ない",
            assertion: "JSON と util.inspect のどちらも値をマスクする",
          },
        ],
      },
      {
        slug: "03-result-errors",
        steps: [
          {
            id: "s3-invalid-state",
            group: "Step 1: InvalidAppointmentState を値として返す",
            assertion: "CheckedIn でない予約でも例外を投げない",
          },
          {
            id: "s3-not-found",
            group: "Step 2: AppointmentNotFound を値として返す",
            assertion: "予約が見つからなくても例外を投げない",
          },
          {
            id: "s3-result-pipeline",
            group: "Step 3: andThen pipeline が失敗理由を運ぶ",
            assertion: "予約なしを InvalidAppointmentState に潰さない",
          },
        ],
      },
      {
        slug: "04-effects-and-events",
        steps: [
          {
            id: "s4-inject-context",
            group: "Step 1: 同じ clock と ID generator なら同じイベントになる",
            assertion: "固定 context から同じ eventId と occurredAt を返す",
          },
          {
            id: "s4-atomic-store",
            group: "Step 2: 状態と監査記録は1回の保存で残る",
            assertion: "store(event) を1回だけ呼ぶ",
          },
          {
            id: "s4-result-async",
            group: "Step 3: 非同期保存後もイベントが pipeline に残る",
            assertion:
              "保存成功時は store の void ではなく aggregateState を返す",
          },
          {
            id: "s4-propagate-store-failure",
            group: "Step 4: 保存失敗時は状態も記録も残らない",
            assertion: "RepositoryError を返し in-memory state を変更しない",
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
