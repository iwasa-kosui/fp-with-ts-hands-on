import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { guardConfigPath, mechanisms } from "./model.mjs";

/** @typedef {import("./model.mjs").GuardCase} GuardCase */
/** @typedef {import("./model.mjs").GuardConfig} GuardConfig */
/** @typedef {import("./model.mjs").Mechanism} Mechanism */
/** @typedef {Readonly<{ id: string, file: string }>} CaseEntry */

export class GuardConfigError extends Error {
  /** @param {readonly string[]} messages */
  constructor(messages) {
    super(messages.join("\n"));
    this.name = "GuardConfigError";
    this.messages = messages;
  }
}

const idPattern = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * @param {unknown} value
 * @returns {value is readonly Mechanism[]}
 */
const isMechanismList = (value) =>
  Array.isArray(value) && value.every((item) => mechanisms.includes(item));

/**
 * @param {string} casesDir
 * @returns {Readonly<{ entries: readonly CaseEntry[], errors: readonly string[] }>}
 */
export const listCaseEntries = (casesDir) => {
  if (!existsSync(casesDir)) {
    return { entries: [], errors: ["exercises/guard/cases/ がありません。"] };
  }
  const results = readdirSync(casesDir, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((dirent) => {
      if (dirent.isDirectory()) {
        const file = path.join(casesDir, dirent.name, "index.ts");
        return existsSync(file)
          ? { entry: { id: dirent.name, file } }
          : { error: `exercises/guard/cases/${dirent.name}/ に index.ts がありません。` };
      }
      return dirent.name.endsWith(".ts") && !dirent.name.endsWith(".d.ts")
        ? { entry: { id: dirent.name.slice(0, -3), file: path.join(casesDir, dirent.name) } }
        : {};
    });
  return {
    entries: results.flatMap((result) => ("entry" in result && result.entry ? [result.entry] : [])),
    errors: results.flatMap((result) => ("error" in result && result.error ? [result.error] : [])),
  };
};

/**
 * @param {readonly string[]} names
 * @returns {(raw: unknown, index: number) => Readonly<{ value?: GuardCase, errors: readonly string[] }>}
 */
const normalizeCase = (names) => (raw, index) => {
  const at = `cases[${index}]`;
  if (!isRecord(raw)) {
    return { errors: [`${at} がオブジェクトではありません。`] };
  }
  const id = typeof raw.id === "string" ? raw.id : "";
  const name = id === "" ? at : `${at}（${id}）`;
  const kind = raw.kind === "bad" || raw.kind === "good" ? raw.kind : undefined;
  const subject = typeof raw.subject === "string" ? raw.subject : "";
  const title = typeof raw.title === "string" ? raw.title : "";
  const stage = raw.stage ?? 1;
  const required = raw.required ?? true;
  const hint = raw.hint ?? "";
  const allowRaw = raw.allow ?? [];
  const errors = [
    ...(idPattern.test(id) ? [] : [`${at} の id は英数字と _ - . で書きます（いまの値: ${String(raw.id)}）。`]),
    ...(kind === undefined ? [`${name} の kind は "bad" か "good" にします。`] : []),
    ...(names.includes(subject) ? [] : [`${name} の subject「${subject}」は subjects にありません。`]),
    ...(title === "" ? [`${name} の title がありません。`] : []),
    ...(typeof stage === "number" && Number.isInteger(stage) && stage >= 1
      ? []
      : [`${name} の stage は 1 以上の整数にします。`]),
    ...(typeof required === "boolean" ? [] : [`${name} の required は true か false にします。`]),
    ...(typeof hint === "string" ? [] : [`${name} の hint は文字列にします。`]),
    ...(isMechanismList(allowRaw)
      ? []
      : [`${name} の allow は "types"、"lint"、"tests" の配列にします。`]),
    ...(kind === "bad" && !(isMechanismList(allowRaw) && allowRaw.length > 0)
      ? [`${name}（bad）には allow が要ります。"types"、"lint"、"tests" から 1 つ以上選びます。`]
      : []),
  ];
  return errors.length > 0 ||
    kind === undefined ||
    typeof stage !== "number" ||
    typeof required !== "boolean" ||
    typeof hint !== "string" ||
    !isMechanismList(allowRaw)
    ? { errors }
    : { value: { id, kind, subject, title, stage, required, allow: allowRaw, hint }, errors };
};

/**
 * @param {readonly string[]} ids
 * @returns {readonly string[]}
 */
const duplicates = (ids) => [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];

/**
 * @param {unknown} raw
 * @param {Readonly<{ caseEntries: readonly CaseEntry[], listErrors: readonly string[], subjectExists: (relativePath: string) => boolean }>} context
 * @returns {GuardConfig}
 */
export const validateConfig = (raw, { caseEntries, listErrors, subjectExists }) => {
  if (!isRecord(raw) || !isRecord(raw.subjects) || !Array.isArray(raw.cases)) {
    throw new GuardConfigError([
      `${guardConfigPath} は { subjects, cases } を default export します。`,
    ]);
  }
  const subjects = Object.fromEntries(
    Object.entries(raw.subjects).map(([name, file]) => [name, String(file)]),
  );
  const normalized = raw.cases.map(normalizeCase(Object.keys(subjects)));
  const cases = normalized.flatMap((item) => (item.value ? [item.value] : []));
  const declaredIds = raw.cases.flatMap((item) =>
    isRecord(item) && typeof item.id === "string" ? [item.id] : [],
  );
  const fileIds = caseEntries.map((entry) => entry.id);
  const errors = [
    ...listErrors,
    ...Object.entries(subjects)
      .filter(([, file]) => !subjectExists(file))
      .map(([name, file]) => `subjects の「${name}」のファイル ${file} がありません。`),
    ...normalized.flatMap((item) => item.errors),
    ...duplicates(declaredIds).map((id) => `id「${id}」が重複しています。`),
    ...declaredIds
      .filter((id, index) => declaredIds.indexOf(id) === index && !fileIds.includes(id))
      .map((id) => `ケース「${id}」は定義にありますが、exercises/guard/cases/ にファイルがありません。`),
    ...fileIds
      .filter((id) => !declaredIds.includes(id))
      .map((id) => `exercises/guard/cases/ の「${id}」は ${guardConfigPath} に定義がありません。`),
    ...duplicates(fileIds).map((id) => `exercises/guard/cases/ に「${id}」が複数あります。`),
  ];
  if (errors.length > 0) {
    throw new GuardConfigError(errors);
  }
  return { subjects, cases };
};

/**
 * @param {string} root
 * @returns {Promise<Readonly<{ config: GuardConfig, caseFiles: Readonly<Record<string, string>> }>>}
 */
export const loadConfig = async (root) => {
  const configFile = path.join(root, guardConfigPath);
  if (!existsSync(configFile)) {
    throw new GuardConfigError([`${guardConfigPath} がありません。`]);
  }
  const loaded = await import(pathToFileURL(configFile).href).catch(
    /** @param {unknown} error */
    (error) => {
      throw new GuardConfigError([
        `${guardConfigPath} を読み込めませんでした: ${error instanceof Error ? error.message : String(error)}`,
      ]);
    },
  );
  const { entries, errors } = listCaseEntries(path.join(root, "exercises/guard/cases"));
  const config = validateConfig(loaded.default, {
    caseEntries: entries,
    listErrors: errors,
    subjectExists: (relativePath) => existsSync(path.resolve(root, relativePath)),
  });
  return {
    config,
    caseFiles: Object.fromEntries(entries.map((entry) => [entry.id, entry.file])),
  };
};
