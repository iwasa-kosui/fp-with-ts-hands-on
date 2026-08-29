import { readdir, readFile, stat } from "node:fs/promises";

import { describe, expect, it } from "vitest";

type PackageJson = Readonly<{
  name?: string;
  scripts?: Readonly<Record<string, string>>;
}>;

const rootUrl = new URL("../../../", import.meta.url);

const sessionsWithSemanticIds = ["03", "04", "05", "06", "07"] as const;
const ownedIdentifierPaths = [
  "domain/appointment/appointmentId.ts",
  "domain/appointment/veterinarianId.ts",
  "domain/owner/ownerId.ts",
  "domain/pet/petId.ts",
  "domain/examResult/examId.ts",
] as const;
const publicApiPaths = [
  "domain/appointment/index.ts",
  "domain/owner/index.ts",
  "domain/pet/index.ts",
  "domain/examResult/index.ts",
] as const;

const collectTypeScriptFiles = async (directoryUrl: URL): Promise<URL[]> => {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryUrl = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directoryUrl);
      if (entry.isDirectory()) return collectTypeScriptFiles(entryUrl);
      return entry.isFile() && entry.name.endsWith(".ts") ? [entryUrl] : [];
    }),
  );

  return files.flat();
};

const collectSessionTypeScriptFiles = async (sessionUrl: URL): Promise<URL[]> => {
  const directories = ["src/", "test/", "exercises/"];
  const files = await Promise.all(
    directories.map(async (directory) => {
      try {
        return await collectTypeScriptFiles(new URL(directory, sessionUrl));
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw error;
      }
    }),
  );

  return files.flat();
};

const relativeJavaScriptImports = (source: string): string[] =>
  [...source.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["'](\.[^"']+\.js)["']/g)].map(
    (match) => match[1],
  );

const assertAcyclicRelativeImports = async (files: URL[]): Promise<void> => {
  const fileUrls = new Set(files.map((file) => file.href));
  const graph = new Map<string, string[]>();

  for (const file of files) {
    const source = await readFile(file, "utf8");
    graph.set(
      file.href,
      relativeJavaScriptImports(source)
        .map((specifier) => new URL(specifier.replace(/\.js$/, ".ts"), file).href)
        .filter((target) => fileUrls.has(target)),
    );
  }

  const visiting: string[] = [];
  const visited = new Set<string>();
  const visit = (node: string): void => {
    const cycleStart = visiting.indexOf(node);
    if (cycleStart !== -1) {
      const cycle = [...visiting.slice(cycleStart), node].map((url) => new URL(url).pathname);
      throw new Error(`Relative import cycle: ${cycle.join(" -> ")}`);
    }
    if (visited.has(node)) return;

    visiting.push(node);
    for (const dependency of graph.get(node) ?? []) visit(dependency);
    visiting.pop();
    visited.add(node);
  };

  for (const file of files) visit(file.href);
};

const readJson = async (url: URL): Promise<PackageJson> =>
  JSON.parse(await readFile(url, "utf8")) as PackageJson;

describe("runnable session package contract", () => {
  it("discovers all eight sessions with runnable package scripts", async () => {
    const examplesUrl = new URL("examples/", rootUrl);
    const sessionDirectories = (await readdir(examplesUrl, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && /^session-\d{2}$/.test(entry.name))
      .map(({ name }) => name)
      .sort();

    expect(sessionDirectories).toEqual([
      "session-00",
      "session-01",
      "session-02",
      "session-03",
      "session-04",
      "session-05",
      "session-06",
      "session-07",
    ]);

    for (const directory of sessionDirectories) {
      const packageJson = await readJson(new URL(`${directory}/package.json`, examplesUrl));
      expect(packageJson.name, directory).toBe(`@fp-with-ts/clinic-${directory}`);
      expect(Object.keys(packageJson.scripts ?? {}), directory).toEqual(
        expect.arrayContaining(["dev", "build", "typecheck", "test"]),
      );
    }
  });

  it("connects every demo and shared Web package to root commands", async () => {
    const packageJson = await readJson(new URL("package.json", rootUrl));

    for (const session of ["00", "01", "02", "03", "04", "05", "06", "07"]) {
      expect(packageJson.scripts, `demo:${session}`).toHaveProperty(`demo:${session}`);
    }
    for (const command of ["build", "test", "typecheck"]) {
      expect(packageJson.scripts?.[command], command).toContain("./examples/session-*");
      expect(packageJson.scripts?.[command], command).toContain("@fp-with-ts/clinic-web");
    }
  });

  it("keeps session 03 through 07 identifiers in their owning domain concepts", async () => {
    for (const session of sessionsWithSemanticIds) {
      const sessionUrl = new URL(`examples/session-${session}/`, rootUrl);
      await expect(stat(new URL("src/domain/ids/", sessionUrl))).rejects.toMatchObject({
        code: "ENOENT",
      });

      for (const path of [...ownedIdentifierPaths, ...publicApiPaths]) {
        await expect(stat(new URL(`src/${path}`, sessionUrl))).resolves.toMatchObject({
          isFile: expect.any(Function),
        });
      }

      const files = await collectSessionTypeScriptFiles(sessionUrl);
      for (const file of files) {
        await expect(readFile(file, "utf8")).resolves.not.toContain("/domain/ids/");
      }
      await assertAcyclicRelativeImports(files);
    }
  });
});
