import { spawn } from "node:child_process";
import { cp, copyFile, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { sessions } from "../../sessions/catalog";

type CommandResult = Readonly<{
  label: string;
  exitCode: number;
  output: string;
}>;

const repoRoot = resolve(process.cwd(), "../..");
const starterRoot = resolve(repoRoot, "examples/session-04");
const solutionRoot = resolve(repoRoot, "examples/session-05");

describe("S4 full-file fallback overlay", () => {
  it("catalog targetsだけを次snapshotで置換すると型検査・回帰・exerciseがすべてGREENになる", async () => {
    const overlayRoot = await mkdtemp(resolve(repoRoot, "examples/.s4-overlay-"));

    try {
      await cp(starterRoot, overlayRoot, {
        recursive: true,
        filter: (source) => !source.endsWith("/node_modules"),
      });
      await symlink(resolve(starterRoot, "node_modules"), resolve(overlayRoot, "node_modules"));

      const s4 = sessions.find(({ slug }) => slug === "04-effects-and-events");
      expect(s4?.kind).toBe("exercise");
      if (s4?.kind !== "exercise") return;

      const targets = [...new Set(s4.steps.flatMap(({ targets }) => targets))];
      const solutionPaths = new Set(
        s4.steps.flatMap(({ solutions }) => solutions.map(({ path }) => path)),
      );

      for (const target of targets) {
        const relativePath = target.slice("examples/session-04/".length);
        const solutionPath = `examples/session-05/${relativePath}`;
        expect(solutionPaths, target).toContain(solutionPath);
        await mkdir(resolve(overlayRoot, relativePath, ".."), { recursive: true });
        await copyFile(resolve(solutionRoot, relativePath), resolve(overlayRoot, relativePath));
      }

      const results = await Promise.all([
        run(
          "typecheck",
          resolve(repoRoot, "node_modules/.bin/tsc"),
          ["--noEmit"],
          overlayRoot,
        ),
        run(
          "regression",
          resolve(starterRoot, "node_modules/.bin/vitest"),
          ["run", "--config", "vitest.config.ts"],
          overlayRoot,
        ),
        run(
          "exercise",
          resolve(starterRoot, "node_modules/.bin/vitest"),
          ["run", "--config", "vitest.exercises.config.ts"],
          overlayRoot,
        ),
      ]);

      expect(
        results.map(({ label, exitCode }) => ({ label, exitCode })),
        results.map(({ label, output }) => `${label}:\n${output}`).join("\n"),
      ).toEqual([
        { label: "typecheck", exitCode: 0 },
        { label: "regression", exitCode: 0 },
        { label: "exercise", exitCode: 0 },
      ]);
    } finally {
      await rm(overlayRoot, { recursive: true, force: true });
    }
  }, 30_000);
});

const run = (
  label: string,
  command: string,
  args: readonly string[],
  cwd: string,
): Promise<CommandResult> =>
  new Promise((resolveResult) => {
    const child = spawn(command, args, { cwd });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      output += String(chunk);
    });
    child.on("error", (error) => {
      resolveResult({ label, exitCode: 1, output: `${output}\n${error.message}` });
    });
    child.on("close", (exitCode) => {
      resolveResult({ label, exitCode: exitCode ?? 1, output });
    });
  });
