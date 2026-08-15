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
});
