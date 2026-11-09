import { buildNext } from "./next.mjs";
import { mechanisms } from "./model.mjs";

/** @typedef {import("./model.mjs").Cell} Cell */
/** @typedef {import("./model.mjs").Cells} Cells */
/** @typedef {import("./model.mjs").Detection} Detection */
/** @typedef {import("./model.mjs").Detections} Detections */
/** @typedef {import("./model.mjs").Durations} Durations */
/** @typedef {import("./model.mjs").Evidence} Evidence */
/** @typedef {import("./model.mjs").GuardCase} GuardCase */
/** @typedef {import("./model.mjs").GuardResult} GuardResult */
/** @typedef {import("./model.mjs").Mechanism} Mechanism */
/** @typedef {import("./model.mjs").Problem} Problem */
/** @typedef {import("./model.mjs").Row} Row */
/** @typedef {Readonly<{ types: Evidence, lint: Evidence, tests: Evidence }>} AllEvidence */
/** @typedef {Readonly<{ cases: readonly GuardCase[], evidence: AllEvidence, builtin: Readonly<Record<string, readonly Detection[]>>, collectionErrors: Readonly<Record<string, readonly Detection[]>>, problems: readonly Problem[], notes: readonly string[], unchangedIds: readonly string[], durations: Durations, revealAllStages: boolean }>} AggregateInput */

/**
 * @param {Evidence} evidence
 * @param {string} id
 * @returns {readonly Detection[]}
 */
const detectionsOf = (evidence, id) => evidence.byCase[id] ?? [];

/**
 * @param {GuardCase} guardCase
 * @param {AggregateInput} input
 * @returns {Row}
 */
const buildRow = (guardCase, { evidence, builtin, collectionErrors, unchangedIds }) => {
  const id = guardCase.id;
  const isBad = guardCase.kind === "bad";
  const builtinTypes = builtin[id] ?? [];
  const loadErrors = collectionErrors[id] ?? [];
  /** @type {Detections} */
  const detections = {
    types: detectionsOf(evidence.types, id),
    lint: detectionsOf(evidence.lint, id),
    tests: detectionsOf(evidence.tests, id),
  };
  /** @param {Mechanism} mechanism @returns {Cell} */
  const cellFor = (mechanism) => {
    const found = detections[mechanism].length + (!isBad && mechanism === "types" ? builtinTypes.length : 0);
    const loadFailed = mechanism === "tests" && loadErrors.length > 0;
    return isBad && !guardCase.allow.includes(mechanism)
      ? { state: "na", count: found }
      : found > 0
        ? { state: "hit", count: found }
        : evidence[mechanism].failed || loadFailed
          ? { state: "error", count: 0 }
          : { state: "none", count: 0 };
  };
  /** @type {Cells} */
  const cells = { types: cellFor("types"), lint: cellFor("lint"), tests: cellFor("tests") };
  const hit = mechanisms.some((mechanism) => cells[mechanism].state === "hit");
  return {
    id,
    kind: guardCase.kind,
    title: guardCase.title,
    stage: guardCase.stage,
    required: guardCase.required,
    allow: guardCase.allow,
    hint: guardCase.hint,
    cells,
    verdict: isBad
      ? hit ? "detected" : unchangedIds.includes(id) ? "unchanged" : "slipped"
      : hit || loadErrors.length > 0 ? "falsePositive" : "noFalsePositive",
    detections,
    builtinTypes,
    collectionErrors: loadErrors,
  };
};

/**
 * @param {readonly Row[]} rows
 * @returns {boolean}
 */
const stageOneClear = (rows) =>
  rows
    .filter((row) => row.stage === 1)
    .every((row) =>
      row.kind === "bad" ? !row.required || row.verdict === "detected" : row.verdict === "noFalsePositive",
    );

/**
 * @param {AggregateInput} input
 * @returns {GuardResult}
 */
export const aggregate = (input) => {
  const allRows = input.cases.map((guardCase) => buildRow(guardCase, input));
  const opensByGate = stageOneClear(allRows);
  const open = input.revealAllStages || opensByGate;
  const rows = allRows.filter((row) => row.stage === 1 || open);
  const hiddenCount = allRows.length - rows.length;
  const passed =
    input.problems.length === 0 &&
    allRows.every((row) =>
      row.kind === "bad" ? !row.required || row.verdict === "detected" : row.verdict === "noFalsePositive",
    );
  const laterBad = rows.filter((row) => row.kind === "bad" && row.stage > 1);
  const stageOpened =
    !input.revealAllStages && opensByGate
      ? laterBad.filter((row) => row.required && row.verdict !== "detected").length > 0
        ? laterBad.length
        : 0
      : 0;
  return {
    version: 1,
    passed,
    rows,
    hiddenCount,
    problems: input.problems.map((problem) => problem.message),
    notes: input.notes,
    next: buildNext({
      rows,
      problems: input.problems,
      stageOpened,
      passed,
      typesAllowed: allRows.some((row) => row.kind === "bad" && row.allow.includes("types")),
    }),
    durations: input.durations,
  };
};
