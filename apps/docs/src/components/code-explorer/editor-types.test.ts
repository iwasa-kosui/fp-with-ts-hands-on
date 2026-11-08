import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";
import { guardAnswerDisplayFiles, guardPaths } from "../../code-explorer/guard-paths";
import { projectFilesForSnapshot } from "../../code-explorer/project-files";
import { readExternalTypeFiles, type TypeFileReader } from "../../code-explorer/runner";
import type { ProjectFiles } from "../../code-explorer/types";
import { buildAmbientModules } from "./ambient-modules";
import { editorCompilerOptions } from "./editor-compiler-options";

const repositoryRoot = path.resolve(__dirname, "../../../../..");
const exerciseSnapshot = "session-03-solution";
const exerciseDirectory = path.join(repositoryRoot, "examples", exerciseSnapshot);
const virtualProject = "workspace";

type Dirent = Awaited<ReturnType<TypeFileReader["readdir"]>>[number];

const packageNameAt = (directory: string): string => {
  const segments = directory.split(path.sep);
  const name = segments.at(-1)!;
  const scope = segments.at(-2)!;
  return scope.startsWith("@") ? `${scope}/${name}` : name;
};

const dependencyNamesOf = (realDirectory: string): string[] => {
  const manifest = JSON.parse(
    readFileSync(path.join(realDirectory, "package.json"), "utf8"),
  ) as Record<string, Record<string, string> | undefined>;
  return [
    ...Object.keys(manifest["dependencies"] ?? {}),
    ...Object.keys(manifest["peerDependencies"] ?? {}),
  ];
};

const listInstalledPackages = (): Map<string, string> => {
  const topLevel = path.join(exerciseDirectory, "node_modules");
  const installed = new Map<string, string>();
  const queue: { virtual: string; real: string }[] = [];

  for (const entry of readdirSync(topLevel)) {
    if (entry.startsWith(".")) continue;
    const candidates = entry.startsWith("@")
      ? readdirSync(path.join(topLevel, entry)).map((name) => `${entry}/${name}`)
      : [entry];
    for (const name of candidates) {
      if (name.startsWith("@fp-with-ts/")) continue;
      queue.push({
        virtual: `node_modules/${name}`,
        real: realpathSync(path.join(topLevel, name)),
      });
    }
  }

  for (let index = 0; index < queue.length; index += 1) {
    const { virtual, real } = queue[index]!;
    if (installed.has(virtual)) continue;
    installed.set(virtual, real);
    const nodeModules = real.slice(0, real.length - packageNameAt(real).length);
    for (const dependency of dependencyNamesOf(real)) {
      const dependencyPath = path.join(nodeModules, dependency);
      if (!existsSync(dependencyPath)) continue;
      const dependencyReal = realpathSync(dependencyPath);
      const hoisted = `node_modules/${dependency}`;
      const existing = installed.get(hoisted);
      if (existing === dependencyReal) continue;
      queue.push({
        virtual: existing === undefined ? hoisted : `${virtual}/${hoisted}`,
        real: dependencyReal,
      });
    }
  }
  return installed;
};

// npm が WebContainer に作る node_modules と同じ平らな配置を、pnpm の依存関係から再現する。
const createInstalledReader = (): TypeFileReader => {
  const installed = listInstalledPackages();
  const virtualToReal = (virtualPath: string): string | undefined => {
    const relative = virtualPath.slice(virtualProject.length + 1);
    const owner = [...installed.keys()]
      .filter((key) => relative === key || relative.startsWith(`${key}/`))
      .sort((left, right) => right.length - left.length)[0];
    return owner === undefined
      ? undefined
      : path.join(installed.get(owner)!, relative.slice(owner.length));
  };

  return {
    readdir: async (virtualPath) => {
      const relative = virtualPath.slice(virtualProject.length + 1);
      const entries = new Map<string, Dirent>();
      const real = virtualToReal(virtualPath);
      if (real !== undefined && existsSync(real)) {
        for (const name of readdirSync(real)) {
          const stats = statSync(path.join(real, name));
          entries.set(name, {
            name,
            isDirectory: () => stats.isDirectory(),
            isFile: () => stats.isFile(),
          });
        }
      }
      for (const key of installed.keys()) {
        if (!key.startsWith(`${relative}/`)) continue;
        const name = key.slice(relative.length + 1).split("/")[0]!;
        entries.set(name, {
          name,
          isDirectory: () => true,
          isFile: () => false,
        });
      }
      if (entries.size === 0) {
        throw Object.assign(new Error(`ENOENT: ${virtualPath}`), { code: "ENOENT" });
      }
      return [...entries.values()];
    },
    readFile: async (virtualPath) => {
      const real = virtualToReal(virtualPath);
      if (real === undefined || !lstatSync(real).isFile()) {
        throw Object.assign(new Error(`ENOENT: ${virtualPath}`), { code: "ENOENT" });
      }
      return readFileSync(real, "utf8");
    },
  };
};

const toEditorPath = (projectPath: string): string =>
  new URL(projectPath, "file:///workspace/").pathname;

const toTypeLibPath = (uri: string): string => new URL(uri).pathname;

// MonacoEditor と同じ入力で TypeScript のプログラムを作る。Monaco の worker と同じく、
// 開いているファイルと追加した型定義をすべて root にし、ファイルの有無だけで解決する。
const createEditorProgram = (
  files: ProjectFiles,
  typeFiles: ProjectFiles,
): ts.Program => {
  const sources = new Map<string, string>();
  for (const [projectPath, source] of Object.entries(files)) {
    sources.set(toEditorPath(projectPath), source);
  }
  for (const [uri, source] of Object.entries(typeFiles)) {
    sources.set(toTypeLibPath(uri), source);
  }
  sources.set(
    "/workspace/playground-ambient.d.ts",
    buildAmbientModules(files, typeFiles),
  );

  const libraryDirectory = path.dirname(ts.sys.getExecutingFilePath());
  const readSource = (fileName: string): string | undefined =>
    sources.get(fileName) ??
    (path.basename(fileName).startsWith("lib.") && fileName.endsWith(".d.ts")
      ? ts.sys.readFile(path.join(libraryDirectory, path.basename(fileName)))
      : undefined);

  const host: ts.CompilerHost = {
    getSourceFile: (fileName, languageVersion) => {
      const text = readSource(fileName);
      return text === undefined
        ? undefined
        : ts.createSourceFile(fileName, text, languageVersion, false);
    },
    getDefaultLibFileName: (compilerOptions) =>
      ts.getDefaultLibFileName(compilerOptions),
    writeFile: () => undefined,
    getCurrentDirectory: () => "/",
    getCanonicalFileName: (fileName) => fileName,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
    fileExists: (fileName) => readSource(fileName) !== undefined,
    readFile: readSource,
  };
  return ts.createProgram(
    [...sources.keys()],
    editorCompilerOptions as unknown as ts.CompilerOptions,
    host,
  );
};

const diagnose = (
  files: ProjectFiles,
  typeFiles: ProjectFiles,
  targets: readonly string[],
): string[] => {
  const program = createEditorProgram(files, typeFiles);
  return targets.flatMap((target) => {
    const sourceFile = program.getSourceFile(toEditorPath(target));
    if (sourceFile === undefined) return [`${target}: not found in the program`];
    return [
      ...program.getSyntacticDiagnostics(sourceFile),
      ...program.getSemanticDiagnostics(sourceFile),
    ].map((diagnostic) => {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(
        diagnostic.start ?? 0,
      );
      return `${target}:${line + 1}:${character + 1} TS${diagnostic.code} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`;
    });
  });
};

const typeOfExport = (
  files: ProjectFiles,
  typeFiles: ProjectFiles,
  probeSource: string,
  name: string,
): string => {
  const probePath = "exercises/guard/mine/probe.ts";
  const program = createEditorProgram(
    { ...files, [probePath]: probeSource },
    typeFiles,
  );
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(toEditorPath(probePath))!;
  const symbol = checker
    .getExportsOfModule(checker.getSymbolAtLocation(sourceFile)!)
    .find((candidate) => candidate.name === name)!;
  return checker.typeToString(
    checker.getTypeOfSymbolAtLocation(symbol, sourceFile),
    undefined,
    ts.TypeFormatFlags.NoTruncation,
  );
};

describe("editor types for the S03 guard exercise", () => {
  let typeFiles: ProjectFiles;
  const starterFiles = projectFilesForSnapshot(exerciseSnapshot);
  const mineTargets = Object.keys(starterFiles).filter(
    (candidate) =>
      candidate.startsWith(guardPaths.mine) && candidate.endsWith(".ts"),
  );

  beforeAll(async () => {
    typeFiles = await readExternalTypeFiles(
      createInstalledReader(),
      virtualProject,
    );
  }, 60_000);

  it("hands the editor the type definitions of fast-check and the package its .d.ts files import", () => {
    const paths = Object.keys(typeFiles);

    expect(paths).toContain("file:///workspace/node_modules/fast-check/package.json");
    expect(paths).toContain("file:///workspace/node_modules/fast-check/lib/fast-check.d.ts");
    expect(paths).toContain("file:///workspace/node_modules/pure-rand/package.json");
  });

  it("types fast-check and vitest instead of leaving them as any", () => {
    const probe = [
      'import fc from "fast-check";',
      'import { expect } from "vitest";',
      "export const arbitrary = fc.string();",
      "export const assertion = expect(1);",
      "",
    ].join("\n");

    expect(typeOfExport(starterFiles, typeFiles, probe, "arbitrary")).toBe(
      "Arbitrary<string>",
    );
    expect(typeOfExport(starterFiles, typeFiles, probe, "assertion")).toBe(
      "Assertion<number>",
    );
  });

  it("opens the five starter files in mine/ with no type errors", () => {
    expect(mineTargets).toHaveLength(5);
    expect(diagnose(starterFiles, typeFiles, mineTargets)).toEqual([]);
  });

  it("opens the model answer placed in mine/ with no type errors", () => {
    const answerFiles = guardAnswerDisplayFiles(starterFiles);
    const files = { ...starterFiles, ...answerFiles };
    const targets = Object.keys(answerFiles).filter((candidate) =>
      candidate.endsWith(".ts"),
    );

    expect(targets).toHaveLength(5);
    expect(diagnose(files, typeFiles, targets)).toEqual([]);
  });
});
