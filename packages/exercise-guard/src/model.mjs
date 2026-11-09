/** @typedef {"types" | "lint" | "tests"} Mechanism */
/** @typedef {Readonly<{ text: string, value?: string }>} GuardBehaviorPart */
/** @typedef {Readonly<{ input: GuardBehaviorPart, expected: GuardBehaviorPart, actual: GuardBehaviorPart }>} GuardBehavior */
/** @typedef {Readonly<{ id: string, kind: "bad" | "good", subject: string, title: string, stage: number, required: boolean, allow: readonly Mechanism[], hint: string, unchangedFrom?: string, behavior?: GuardBehavior }>} GuardCase */
/** @typedef {Readonly<{ subjects: Readonly<Record<string, string>>, cases: readonly GuardCase[], vitestBaseConfig?: string }>} GuardConfig */
/** @typedef {Readonly<{ mechanism: Mechanism, file: string, line: number | null, label: string, message: string }>} Detection */
/** @typedef {"hit" | "none" | "error" | "na"} CellState */
/** @typedef {Readonly<{ state: CellState, count: number }>} Cell */
/** @typedef {Readonly<Record<Mechanism, Cell>>} Cells */
/** @typedef {Readonly<Record<Mechanism, readonly Detection[]>>} Detections */
/** @typedef {"detected" | "slipped" | "unchanged" | "falsePositive" | "noFalsePositive"} Verdict */
/** @typedef {Readonly<{ id: string, kind: "bad" | "good", title: string, stage: number, required: boolean, allow: readonly Mechanism[], hint: string, cells: Cells, verdict: Verdict, detections: Detections, builtinTypes: readonly Detection[], collectionErrors: readonly Detection[] }>} Row */
/** @typedef {Readonly<{ types: number, lint: number, tests: number, total: number }>} Durations */
/** @typedef {Readonly<{ version: 1, passed: boolean, rows: readonly Row[], hiddenCount: number, problems: readonly string[], notes: readonly string[], next: readonly string[], durations: Durations, testsTimedOut: boolean }>} GuardResult */
/** @typedef {Readonly<{ message: string, fix: string }>} Problem */
/** @typedef {Readonly<Record<string, readonly Detection[]>>} ByCase */
/** @typedef {Readonly<{ failed: boolean, byCase: ByCase }>} Evidence */

/** @type {readonly Mechanism[]} */
export const mechanisms = ["types", "lint", "tests"];

/** @type {Readonly<Record<Mechanism, string>>} */
export const mechanismNames = {
  types: "型のテスト",
  lint: "Linter",
  tests: "テスト",
};

export const guardConfigPath = "exercises/guard/guard.config.mjs";
export const defaultMineDir = "exercises/guard/mine";
export const defaultEslintConfig = "eslint.config.mjs";
export const defaultWorkDir = "dist/guard";
