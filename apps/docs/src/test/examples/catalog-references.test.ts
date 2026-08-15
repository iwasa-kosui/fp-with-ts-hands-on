import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { sessions } from "../../sessions/catalog";

const repoRoot = resolve(process.cwd(), "../..");
const exerciseSessions = sessions.filter((session) => session.kind === "exercise");

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

      for (const { solution } of session.steps ?? []) {
        const source = await readFile(resolve(repoRoot, solution.path), "utf8");
        const [start, end] = solution.lines;
        expect(start).toBeGreaterThanOrEqual(1);
        expect(end).toBeGreaterThanOrEqual(start);
        const slice = source.split("\n").slice(start - 1, end).join("\n");
        expect(slice).toContain(solution.symbol);
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
