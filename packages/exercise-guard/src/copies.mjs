import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { relativeSpecifier, toPosix } from "./paths.mjs";

/** @typedef {import("./model.mjs").GuardCase} GuardCase */
/** @typedef {Readonly<{ abs: string, rel: string, text: string }>} MineFile */
/** @typedef {Readonly<{ caseId: string, caseDir: string, dest: string, text: string, mineRel: string }>} Copy */
/** @typedef {Readonly<{ spec: string, pos: number, base: string, subject: string | undefined, minePath: string | undefined }>} Import */

/**
 * @param {string} value
 * @returns {boolean}
 */
export const isRunTestFile = (value) => /\.test\.ts$/.test(value);

/**
 * @param {string} value
 * @returns {boolean}
 */
export const isTypeTestFile = (value) => /\.type-test\.ts$/.test(value);

/**
 * @param {string} value
 * @returns {boolean}
 */
export const isTestFile = (value) => isRunTestFile(value) || isTypeTestFile(value);

/**
 * @param {string} value
 * @returns {boolean}
 */
const isSpecFile = (value) => /\.spec\.ts$/.test(value);

/**
 * @param {string} mineDir
 * @returns {readonly MineFile[]}
 */
export const readMineFiles = (mineDir) => {
  /** @param {string} dir @returns {readonly string[]} */
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.name === "node_modules"
        ? []
        : entry.isDirectory()
          ? walk(path.join(dir, entry.name))
          : entry.name.endsWith(".ts")
            ? [path.join(dir, entry.name)]
            : [],
    );
  return (existsSync(mineDir) ? [...walk(mineDir)].sort() : []).map((abs) => ({
    abs,
    rel: toPosix(path.relative(mineDir, abs)),
    text: readFileSync(abs, "utf8"),
  }));
};

/**
 * @param {string} base
 * @returns {readonly string[]}
 */
const candidatesFor = (base) => [
  base,
  base.replace(/\.js$/, ".ts"),
  `${base}.ts`,
  path.join(base, "index.ts"),
];

/**
 * @param {MineFile} file
 * @param {ReadonlyMap<string, string>} subjectByPath
 * @param {ReadonlySet<string>} mineAbsPaths
 * @returns {readonly Import[]}
 */
const analyzeImports = (file, subjectByPath, mineAbsPaths) =>
  ts
    .preProcessFile(file.text, true, true)
    .importedFiles.filter((imported) => imported.fileName.startsWith("."))
    .map((imported) => {
      const base = path.resolve(path.dirname(file.abs), imported.fileName);
      const candidates = candidatesFor(base);
      const subjectPath = candidates.find((candidate) => subjectByPath.has(candidate));
      return {
        spec: imported.fileName,
        pos: imported.pos,
        base,
        subject: subjectPath === undefined ? undefined : subjectByPath.get(subjectPath),
        minePath: candidates.find((candidate) => mineAbsPaths.has(candidate)),
      };
    });

/**
 * @param {ReadonlyMap<string, readonly Import[]>} importsByFile
 * @returns {ReadonlyMap<string, ReadonlySet<string>>}
 */
const subjectsByFile = (importsByFile) => {
  /** @param {ReadonlyMap<string, ReadonlySet<string>>} current @returns {ReadonlyMap<string, ReadonlySet<string>>} */
  const converge = (current) => {
    const next = new Map(
      [...importsByFile].map(([abs, imports]) => [
        abs,
        new Set([
          ...(current.get(abs) ?? []),
          ...imports.flatMap((imported) =>
            imported.subject !== undefined
              ? [imported.subject]
              : imported.minePath !== undefined
                ? [...(current.get(imported.minePath) ?? [])]
                : [],
          ),
        ]),
      ]),
    );
    const grew = [...next].some(([abs, set]) => set.size !== (current.get(abs)?.size ?? 0));
    return grew ? converge(next) : next;
  };
  return converge(new Map([...importsByFile].map(([abs]) => [abs, new Set()])));
};

/**
 * @param {string} text
 * @param {readonly Import[]} imports
 * @param {(imported: Import) => string | undefined} replacementFor
 * @returns {string}
 */
const rewriteImports = (text, imports, replacementFor) =>
  [...imports]
    .sort((left, right) => right.pos - left.pos)
    .reduce((acc, imported) => {
      const replacement = replacementFor(imported);
      const quote = acc[imported.pos];
      const opensSpecifier =
        (quote === '"' || quote === "'") &&
        acc.startsWith(imported.spec, imported.pos + 1) &&
        acc[imported.pos + 1 + imported.spec.length] === quote;
      return replacement === undefined || !opensSpecifier
        ? acc
        : `${acc.slice(0, imported.pos)}${quote}${replacement}${quote}${acc.slice(imported.pos + imported.spec.length + 2)}`;
    }, text);

/**
 * @param {Readonly<{
 *   mineFiles: readonly MineFile[],
 *   subjectPaths: Readonly<Record<string, string>>,
 *   subjectFiles: readonly string[],
 *   cases: readonly GuardCase[],
 *   caseFiles: Readonly<Record<string, string>>,
 *   copiesDir: string,
 *   mineDisplay: (rel: string) => string,
 * }>} input
 * @returns {Readonly<{ copies: readonly Copy[], notes: readonly string[], caseDirs: Readonly<Record<string, string>> }>}
 */
export const planCopies = ({ mineFiles, subjectPaths, subjectFiles, cases, caseFiles, copiesDir, mineDisplay }) => {
  const subjectByPath = new Map(Object.entries(subjectPaths).map(([name, abs]) => [abs, name]));
  const mineAbsPaths = new Set(mineFiles.map((file) => file.abs));
  const importsByFile = new Map(
    mineFiles.map((file) => [file.abs, analyzeImports(file, subjectByPath, mineAbsPaths)]),
  );
  const subjects = subjectsByFile(importsByFile);
  const judged = mineFiles.map((file) => ({
    file,
    subjectNames: subjects.get(file.abs) ?? new Set(),
  }));
  const unjudgedTests = judged.filter(
    ({ file, subjectNames }) => subjectNames.size === 0 && isTestFile(file.rel),
  );
  /** @param {ReadonlySet<string>} seed @returns {ReadonlySet<string>} */
  const withHelpers = (seed) => {
    const next = new Set([
      ...seed,
      ...[...seed].flatMap((abs) =>
        (importsByFile.get(abs) ?? []).flatMap((imported) =>
          imported.minePath === undefined ? [] : [imported.minePath],
        ),
      ),
    ]);
    return next.size === seed.size ? seed : withHelpers(next);
  };
  const copies = cases.flatMap((guardCase, index) => {
    const caseDir = `c${index}`;
    const included = withHelpers(
      new Set(
        judged
          .filter(({ file, subjectNames }) =>
            subjectNames.size === 0 ? !isTestFile(file.rel) : subjectNames.has(guardCase.subject),
          )
          .map(({ file }) => file.abs),
      ),
    );
    return mineFiles
      .filter((file) => included.has(file.abs))
      .map((file) => {
        const dest = path.join(copiesDir, caseDir, file.rel);
        const caseFile = caseFiles[guardCase.id] ?? "";
        const text = rewriteImports(file.text, importsByFile.get(file.abs) ?? [], (imported) =>
          imported.subject === guardCase.subject
            ? relativeSpecifier(path.dirname(dest), caseFile).replace(/\.ts$/, ".js")
            : imported.minePath !== undefined && imported.subject === undefined
              ? undefined
              : relativeSpecifier(path.dirname(dest), imported.base),
        );
        return { caseId: guardCase.id, caseDir, dest, text, mineRel: file.rel };
      });
  });
  return {
    copies,
    caseDirs: Object.fromEntries(cases.map((guardCase, index) => [`c${index}`, guardCase.id])),
    notes: [
      ...unjudgedTests.map(
        ({ file }) =>
          `判定に使わないファイル: ${mineDisplay(file.rel)}（悪い変更の題材を import していないので、どのケースにも当たりません。import する題材: ${subjectFiles.join("、")}）`,
      ),
      ...mineFiles
        .filter((file) => isSpecFile(file.rel))
        .map((file) => `${mineDisplay(file.rel)} は実行しません。テストのファイル名は *.test.ts にします。`),
    ],
  };
};
