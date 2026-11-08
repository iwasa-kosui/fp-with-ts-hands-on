import { existsSync, readFileSync } from "node:fs";

/** @typedef {import("./model.mjs").GuardCase} GuardCase */

/**
 * @param {string} text
 * @returns {string}
 */
const normalize = (text) =>
  text
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("//"))
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();

/**
 * @param {string | undefined} file
 * @returns {string | undefined}
 */
const readNormalized = (file) =>
  file !== undefined && existsSync(file) ? normalize(readFileSync(file, "utf8")) : undefined;

/**
 * @param {readonly GuardCase[]} cases
 * @param {Readonly<Record<string, string>>} caseFiles
 * @returns {readonly string[]}
 */
export const findUnchanged = (cases, caseFiles) =>
  cases.flatMap((guardCase) => {
    const from = guardCase.unchangedFrom;
    const mine = readNormalized(caseFiles[guardCase.id]);
    return from !== undefined && mine !== undefined && mine === readNormalized(caseFiles[from])
      ? [guardCase.id]
      : [];
  });
