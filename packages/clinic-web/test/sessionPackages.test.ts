import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

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
const finalPublicApis = ["appointment", "owner", "pet", "examResult"] as const;
const ownedConcepts = ["appointment", "owner", "pet", "examResult"] as const;
type OwnedConcept = (typeof ownedConcepts)[number];
type PublicExportRequirement = Readonly<{
  concept: OwnedConcept;
  module: string;
  symbol: string;
  typeOnly?: boolean;
  sessions?: ReadonlyArray<(typeof sessionsWithSemanticIds)[number]>;
}>;

const requiredPublicExports: ReadonlyArray<PublicExportRequirement> = [
  {
    concept: "appointment",
    module: "appointment",
    symbol: "Appointment",
    typeOnly: true,
    sessions: ["03", "04", "05"],
  },
  {
    concept: "appointment",
    module: "appointmentApi",
    symbol: "Appointment",
    typeOnly: true,
    sessions: ["06", "07"],
  },
  { concept: "appointment", module: "appointmentId", symbol: "AppointmentId" },
  { concept: "appointment", module: "veterinarianId", symbol: "VeterinarianId" },
  { concept: "appointment", module: "statusLabel", symbol: "toStatusLabel" },
  { concept: "appointment", module: "transitions", symbol: "checkIn" },
  { concept: "appointment", module: "transitions", symbol: "startExamination" },
  { concept: "appointment", module: "transitions", symbol: "completeExamination" },
  { concept: "appointment", module: "transitions", symbol: "recordPayment" },
  { concept: "appointment", module: "transitions", symbol: "cancel" },
  {
    concept: "appointment",
    module: "appointmentApi",
    symbol: "Appointment",
    sessions: ["06", "07"],
  },
  {
    concept: "appointment",
    module: "examinationStarted",
    symbol: "ExaminationStarted",
    typeOnly: true,
    sessions: ["06", "07"],
  },
  { concept: "owner", module: "ownerId", symbol: "OwnerId" },
  { concept: "pet", module: "petId", symbol: "PetId" },
  { concept: "examResult", module: "examId", symbol: "ExamId" },
];

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

const relativeJavaScriptImports = (source: string): string[] => [
  ...new Set([
    ...source.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["'](\.[^"']+\.js)["']/g),
    ...source.matchAll(/\bimport\(\s*["'](\.[^"']+\.js)["']\s*\)/g),
  ].map((match) => match[1]).filter((specifier): specifier is string => specifier !== undefined)),
];

const moduleSpecifiers = (source: string): string[] => [
  ...new Set([
    ...source.matchAll(
      /(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g,
    ),
    ...source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g),
  ].map((match) => match[1]).filter((specifier): specifier is string => specifier !== undefined)),
];

const isSnapshotPackageImport = (specifier: string): boolean =>
  /^@fp-with-ts\/clinic-session-\d{2}(?:\/|$)/.test(specifier);

const assertNoCrossSessionSourceImports = async (sessionUrl: URL): Promise<void> => {
  const sourceFiles = await collectTypeScriptFiles(new URL("src/", sessionUrl));

  for (const file of sourceFiles) {
    const prohibitedSpecifiers = moduleSpecifiers(await readFile(file, "utf8")).filter(
      (specifier) =>
        specifier.includes("../session-") ||
        specifier.includes("examples/session-") ||
        isSnapshotPackageImport(specifier),
    );
    if (prohibitedSpecifiers.length > 0) {
      throw new Error(
        `Session source must not import another session from ${file.pathname}: ${prohibitedSpecifiers.join(", ")}`,
      );
    }
  }
};

const resolvesRelativeJavaScriptImport = (specifier: string, file: URL): URL =>
  new URL(specifier.replace(/\.js$/, ".ts"), file);

const conceptForFile = (file: URL, sessionUrl: URL): OwnedConcept | undefined =>
  ownedConcepts.find((concept) =>
    file.pathname.startsWith(new URL(`src/domain/${concept}/`, sessionUrl).pathname),
  );

const reexportsSymbol = (source: string, requirement: PublicExportRequirement): boolean => {
  const modulePath = `./${requirement.module}.js`;
  const escapedModulePath = modulePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedSymbol = requirement.symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const exportAll = new RegExp(`export\\s+\\*\\s+from\\s+["']${escapedModulePath}["']`);
  if (exportAll.test(source)) return true;

  const exportClause = requirement.typeOnly
    ? "export\\s+(?:type\\s+)?"
    : "export\\s+(?!type\\s)";
  return new RegExp(
    `${exportClause}\\{[^}]*\\b${escapedSymbol}\\b[^}]*\\}\\s+from\\s+["']${escapedModulePath}["']`,
  ).test(source);
};

const exportsSymbol = (source: string, symbol: string): boolean =>
  new RegExp(
    `export\\s+(?:type\\s+)?(?:const|function|class|interface|type)\\s+${symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
  ).test(source);

const assertAcyclicRelativeImports = async (files: URL[], sessionUrl: URL): Promise<void> => {
  const fileUrls = new Set(files.map((file) => file.href));
  const graph = new Map<string, string[]>();
  const sessionSourceRoot = new URL("src/", sessionUrl).pathname;

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const imports = relativeJavaScriptImports(source).map((specifier) =>
      resolvesRelativeJavaScriptImport(specifier, file),
    );
    const escapedSessionSourceImports = imports.filter(
      (target) =>
        !target.pathname.startsWith(sessionSourceRoot) && /\/session-\d{2}\/src\//.test(target.pathname),
    );
    if (escapedSessionSourceImports.length > 0) {
      throw new Error(
        `Relative import escapes session source root from ${file.pathname}: ${escapedSessionSourceImports
          .map((target) => target.pathname)
          .join(", ")}`,
      );
    }
    const escapedDomainImports = imports.filter(
      (target) =>
        target.pathname.startsWith(new URL("src/domain/", sessionUrl).pathname) &&
        !fileUrls.has(target.href),
    );
    if (escapedDomainImports.length > 0) {
      throw new Error(
        `Relative domain import escapes session graph from ${file.pathname}: ${escapedDomainImports
          .map((target) => target.pathname)
          .join(", ")}`,
      );
    }
    graph.set(
      file.href,
      imports
        .map((target) => target.href)
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

const isReexportOnlyIndex = (source: string): boolean =>
  source
    .replace(
      /export\s+(?:type\s+)?(?:\*\s*(?:as\s+\w+\s*)?|\{[\s\S]*?\})\s+from\s+["'][^"']+["']\s*;?/g,
      "",
    )
    .trim() === "";

const assertFinalPublicApiContract = async (finalUrl: URL): Promise<void> => {
  for (const concept of finalPublicApis) {
    const conceptUrl = new URL(`src/domain/${concept}/`, finalUrl);
    const indexUrl = new URL("index.ts", conceptUrl);
    expect((await stat(indexUrl)).isFile(), `final ${concept} public API`).toBe(true);

    const indexSource = await readFile(indexUrl, "utf8");
    expect(isReexportOnlyIndex(indexSource), `${indexUrl.pathname} must only re-export`).toBe(true);

    const implementationFiles = (await readdir(conceptUrl, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts") && entry.name !== "index.ts")
      .map((entry) => entry.name)
      .sort();
    for (const file of implementationFiles) {
      expect(indexSource, `${indexUrl.pathname} must export ${file}`).toMatch(
        new RegExp(`from ["']\\./${file.replace(/\.ts$/, ".js")}["']`),
      );
    }
  }

  const files = await collectSessionTypeScriptFiles(finalUrl);
  for (const file of files) {
      const source = await readFile(file, "utf8");
      const fileConcept = conceptForFile(file, finalUrl);
      for (const specifier of relativeJavaScriptImports(source)) {
        const target = resolvesRelativeJavaScriptImport(specifier, file);
        const targetConcept = conceptForFile(target, finalUrl);
        if (targetConcept === undefined) continue;

        const targetIndex = new URL(`src/domain/${targetConcept}/index.ts`, finalUrl);
        if (fileConcept === targetConcept) {
          expect(target.href, `${file.pathname} must not import its own concept index`).not.toBe(
            targetIndex.href,
          );
          continue;
        }
        expect(
          target.href,
          `${file.pathname} must use ${targetConcept}'s public API outside that concept`,
        ).toBe(targetIndex.href);
      }
  }
};

const writeFinalPublicApiFixture = async (
  directory: string,
  options: Readonly<{ localExport?: boolean; ownIndexImport?: boolean }> = {},
): Promise<URL> => {
  const finalDirectory = join(directory, "final");
  for (const concept of finalPublicApis) {
    const conceptDirectory = join(finalDirectory, "src", "domain", concept);
    await mkdir(conceptDirectory, { recursive: true });
    await writeFile(join(conceptDirectory, `${concept}.ts`), `export const fixture = "${concept}";\n`);

    const indexLines = [
      "export {",
      "  fixture,",
      `} from \"./${concept}.js\";`,
    ];
    if (options.ownIndexImport && concept === "appointment") {
      await writeFile(
        join(conceptDirectory, "implementation.ts"),
        'import "./index.js";\nexport const implementation = true;\n',
      );
      indexLines.push('export * from "./implementation.js";');
    }
    if (options.localExport && concept === "appointment") {
      indexLines.push("export const leaked = true;");
    }
    await writeFile(join(conceptDirectory, "index.ts"), `${indexLines.join("\n")}\n`);
  }

  return new URL(`${pathToFileURL(finalDirectory).href}/`);
};

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
    expect(packageJson.scripts).toHaveProperty(
      "test:continuity",
      "pnpm --filter @fp-with-ts/start-examination-continuity test",
    );
    expect(packageJson.scripts).toHaveProperty(
      "typecheck:continuity",
      "pnpm --filter @fp-with-ts/start-examination-continuity typecheck",
    );
    expect(packageJson.scripts?.test).toContain("pnpm test:continuity");
    expect(packageJson.scripts?.typecheck).toContain("pnpm typecheck:continuity");
  });

  it("rejects source imports from another session while allowing test-only continuity adapters", async () => {
    const fixtureDirectory = await mkdtemp(join(tmpdir(), "session-source-import-contract-"));
    const sessionUrl = new URL(`${pathToFileURL(join(fixtureDirectory, "session-03")).href}/`);
    const sourceDirectory = join(fixtureDirectory, "session-03/src/domain/appointment");
    await mkdir(sourceDirectory, { recursive: true });

    try {
      const relativeImport = new URL("relativeImport.ts", `${pathToFileURL(sourceDirectory).href}/`);
      await writeFile(relativeImport, 'import "../../../../session-04/src/domain/appointment/appointment.js";\n');
      await expect(assertNoCrossSessionSourceImports(sessionUrl)).rejects.toThrow(
        "must not import another session",
      );

      await rm(relativeImport);
      const packageImport = new URL("packageImport.ts", `${pathToFileURL(sourceDirectory).href}/`);
      await writeFile(
        packageImport,
        'import "@fp-with-ts/clinic-session-04/src/domain/appointment/appointment.js";\n',
      );
      await expect(assertNoCrossSessionSourceImports(sessionUrl)).rejects.toThrow(
        "must not import another session",
      );

      await rm(packageImport);
      const packageExport = new URL("packageExport.ts", `${pathToFileURL(sourceDirectory).href}/`);
      await writeFile(
        packageExport,
        'export * from "@fp-with-ts/clinic-session-04/src/domain/appointment/appointment.js";\n',
      );
      await expect(assertNoCrossSessionSourceImports(sessionUrl)).rejects.toThrow(
        "must not import another session",
      );

      await rm(packageExport);
      const packageDynamicImport = new URL(
        "packageDynamicImport.ts",
        `${pathToFileURL(sourceDirectory).href}/`,
      );
      await writeFile(
        packageDynamicImport,
        'void import("@fp-with-ts/clinic-session-04/src/domain/appointment/appointment.js");\n',
      );
      await expect(assertNoCrossSessionSourceImports(sessionUrl)).rejects.toThrow(
        "must not import another session",
      );

      await rm(packageDynamicImport);
      const absoluteImport = new URL("absoluteImport.ts", `${pathToFileURL(sourceDirectory).href}/`);
      await writeFile(absoluteImport, 'import "/workspace/examples/session-04/src/domain/appointment/appointment.js";\n');
      await expect(assertNoCrossSessionSourceImports(sessionUrl)).rejects.toThrow(
        "must not import another session",
      );
    } finally {
      await rm(fixtureDirectory, { recursive: true, force: true });
    }
  });

  it("keeps all session source trees independent", async () => {
    for (const session of ["00", "01", "02", "03", "04", "05", "06", "07"]) {
      await expect(
        assertNoCrossSessionSourceImports(new URL(`examples/session-${session}/`, rootUrl)),
      ).resolves.toBeUndefined();
    }
  });

  it("rejects a relative import that escapes to another session source", async () => {
    const fixtureDirectory = await mkdtemp(join(tmpdir(), "session-import-contract-"));
    const sessionUrl = `${pathToFileURL(join(fixtureDirectory, "session-03")).href}/`;
    const sourcePath = join(
      fixtureDirectory,
      "session-03/src/domain/appointment/crossSessionImport.ts",
    );
    await mkdir(join(fixtureDirectory, "session-03/src/domain/appointment"), { recursive: true });
    await writeFile(
      sourcePath,
      'import "../../../../session-04/src/domain/appointment/appointment.js";\n',
    );

    try {
      await expect(
        assertAcyclicRelativeImports([pathToFileURL(sourcePath)], new URL(sessionUrl)),
      ).rejects.toThrow("escapes session source root");
    } finally {
      await rm(fixtureDirectory, { recursive: true, force: true });
    }
  });

  it("keeps session 03 through 07 identifiers in their owning domain concepts", async () => {
    for (const session of sessionsWithSemanticIds) {
      const sessionUrl = new URL(`examples/session-${session}/`, rootUrl);
      await expect(stat(new URL("src/domain/ids/", sessionUrl))).rejects.toMatchObject({
        code: "ENOENT",
      });

      for (const path of [...ownedIdentifierPaths, ...publicApiPaths]) {
        expect((await stat(new URL(`src/${path}`, sessionUrl))).isFile(), path).toBe(true);
      }

      const files = await collectSessionTypeScriptFiles(sessionUrl);
      for (const file of files) {
        const source = await readFile(file, "utf8");
        expect(source, file.pathname).not.toContain("/domain/ids/");

        const fileConcept = conceptForFile(file, sessionUrl);
        for (const specifier of relativeJavaScriptImports(source)) {
          const target = resolvesRelativeJavaScriptImport(specifier, file);
          const targetConcept = conceptForFile(target, sessionUrl);
          if (targetConcept === undefined) continue;

          const targetIndex = new URL(`src/domain/${targetConcept}/index.ts`, sessionUrl);
          if (fileConcept === targetConcept) {
            expect(target.href, `${file.pathname} must not import its own concept index`).not.toBe(
              targetIndex.href,
            );
          } else {
            expect(target.href, `${file.pathname} must use ${targetConcept}'s public API`).toBe(
              targetIndex.href,
            );
          }
        }
      }
      await assertAcyclicRelativeImports(files, sessionUrl);

      for (const concept of ownedConcepts) {
        const indexSource = await readFile(new URL(`src/domain/${concept}/index.ts`, sessionUrl), "utf8");
        expect(indexSource, `${session} ${concept} index must only re-export`).not.toMatch(/^\s*import\s/m);
        expect(indexSource, `${session} ${concept} index must not define exports`).not.toMatch(
          /^\s*export\s+(?:const|let|class|function|type\s+\w+\s*=)/m,
        );

        for (const requirement of requiredPublicExports) {
          if (requirement.concept !== concept) continue;
          if (requirement.sessions !== undefined && !requirement.sessions.includes(session)) continue;
          const implementationSource = await readFile(
            new URL(`src/domain/${concept}/${requirement.module}.ts`, sessionUrl),
            "utf8",
          );
          expect(exportsSymbol(implementationSource, requirement.symbol), `${session} ${requirement.module}`).toBe(
            true,
          );
          expect(reexportsSymbol(indexSource, requirement), `${session} ${concept} ${requirement.symbol}`).toBe(
            true,
          );
        }
      }
    }
  });

  it("exposes Final domain concepts only through re-export public APIs", async () => {
    const finalUrl = new URL("examples/final/", rootUrl);
    await assertFinalPublicApiContract(finalUrl);
  });

  it("rejects Final public API barrels that define local exports", async () => {
    const fixtureDirectory = await mkdtemp(join(tmpdir(), "final-public-api-contract-"));
    try {
      const finalUrl = await writeFinalPublicApiFixture(fixtureDirectory, { localExport: true });
      await expect(assertFinalPublicApiContract(finalUrl)).rejects.toThrow("must only re-export");
    } finally {
      await rm(fixtureDirectory, { recursive: true, force: true });
    }
  });

  it("rejects Final implementations that import their own concept index", async () => {
    const fixtureDirectory = await mkdtemp(join(tmpdir(), "final-public-api-contract-"));
    try {
      const finalUrl = await writeFinalPublicApiFixture(fixtureDirectory, { ownIndexImport: true });
      await expect(assertFinalPublicApiContract(finalUrl)).rejects.toThrow(
        "must not import its own concept index",
      );
    } finally {
      await rm(fixtureDirectory, { recursive: true, force: true });
    }
  });

  it("accepts multiline Final re-export statements", async () => {
    const fixtureDirectory = await mkdtemp(join(tmpdir(), "final-public-api-contract-"));
    try {
      const finalUrl = await writeFinalPublicApiFixture(fixtureDirectory);
      await expect(assertFinalPublicApiContract(finalUrl)).resolves.toBeUndefined();
    } finally {
      await rm(fixtureDirectory, { recursive: true, force: true });
    }
  });
});
