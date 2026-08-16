import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type PackageManifest = Readonly<{
  name: string;
  scripts: Readonly<Record<string, string>>;
}>;

const repositoryRoot = resolve(process.cwd(), "../..");

const readPackage = async (path: string): Promise<PackageManifest> =>
  JSON.parse(
    await readFile(resolve(repositoryRoot, path), "utf8"),
  ) as PackageManifest;

describe("root CI coverage", () => {
  it.each(["build", "test", "typecheck"] as const)(
    "runs the Final reference package exactly once during root %s",
    async (scriptName) => {
      const [rootPackage, finalPackage] = await Promise.all([
        readPackage("package.json"),
        readPackage("examples/final/package.json"),
      ]);
      const script = rootPackage.scripts[scriptName];
      const finalInvocation = `pnpm --filter ${finalPackage.name} ${scriptName}`;

      expect(finalPackage.name).toBe("@fp-with-ts/clinic-final");
      expect(finalPackage.scripts[scriptName]).toBeDefined();
      expect(script).toContain(finalInvocation);
      expect(script.match(/--filter @fp-with-ts\/clinic-final/g)).toHaveLength(1);
    },
  );

  it("keeps the existing session, docs, and Worker root coverage", async () => {
    const rootPackage = await readPackage("package.json");

    expect(rootPackage.scripts.build).toContain("pnpm --filter @fp-with-ts/docs build");
    expect(rootPackage.scripts.test).toContain(
      "pnpm --filter './examples/session-*' test",
    );
    expect(rootPackage.scripts.test).toContain("pnpm --filter @fp-with-ts/docs test");
    expect(rootPackage.scripts.test).toContain("pnpm test:worker");
    expect(rootPackage.scripts.typecheck).toContain(
      "pnpm --filter './examples/session-*' typecheck",
    );
    expect(rootPackage.scripts.typecheck).toContain(
      "pnpm --filter @fp-with-ts/docs typecheck",
    );
    expect(rootPackage.scripts.typecheck).toContain(
      "tsc -p worker/tsconfig.json --noEmit",
    );
  });

  it.each(["deploy.yml", "preview.yml"])(
    "%s delegates all release gates to root scripts",
    async (workflowName) => {
      const workflow = await readFile(
        resolve(repositoryRoot, `.github/workflows/${workflowName}`),
        "utf8",
      );

      for (const scriptName of ["typecheck", "test", "build"]) {
        expect(
          workflow.match(new RegExp(`run: pnpm ${scriptName}$`, "gm")),
          `${workflowName}: ${scriptName}`,
        ).toHaveLength(1);
      }
    },
  );
});
