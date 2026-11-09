import { describe, expect, it } from "vitest";
import { aggregate } from "../src/aggregate.mjs";

/** @typedef {import("../src/model.mjs").GuardCase} GuardCase */
/** @typedef {import("../src/model.mjs").Evidence} Evidence */
/** @typedef {import("../src/model.mjs").Detection} Detection */

/** @type {Evidence} */
const completed = { failed: false, byCase: {} };
/** @type {Evidence} */
const incomplete = { failed: true, byCase: {} };

/** @type {GuardCase} */
const goodCase = { id: "G1", kind: "good", subject: "input", title: "正しいコード", stage: 1, required: true, allow: [], hint: "" };
/** @type {GuardCase} */
const badCase = { id: "B1", kind: "bad", subject: "input", title: "誤った変更", stage: 1, required: true, allow: ["lint", "tests"], hint: "" };

/**
 * @param {GuardCase} guardCase
 * @param {Readonly<{ types?: Evidence, lint?: Evidence, tests?: Evidence }>} evidence
 * @param {Readonly<Record<string, readonly Detection[]>>} [collectionErrors]
 */
const run = (guardCase, evidence, collectionErrors = {}) =>
  aggregate({
    cases: [guardCase],
    evidence: { types: completed, lint: completed, tests: completed, ...evidence },
    builtin: {},
    collectionErrors,
    problems: [],
    notes: [],
    unchangedIds: [],
    durations: { types: 0, lint: 0, tests: 0, total: 0 },
    revealAllStages: true,
  });

describe("aggregate の verdict", () => {
  it("検査が完了した正しいコードは noFalsePositive で合格する", () => {
    const result = run(goodCase, {});

    expect(result.rows[0]?.verdict).toBe("noFalsePositive");
    expect(result.passed).toBe(true);
  });

  it("検査が完了しなかった正しいコードは noFalsePositive にせず undetermined とし、不合格にする", () => {
    const result = run(goodCase, { tests: incomplete });

    expect(result.rows[0]?.cells.tests.state).toBe("error");
    expect(result.rows[0]?.verdict).toBe("undetermined");
    expect(result.passed).toBe(false);
  });

  it("検査が完了しなかった列に誤検知があれば、正しいコードは falsePositive のまま", () => {
    const hit = /** @type {Detection} */ ({ mechanism: "lint", file: "a.ts", line: 1, label: "rule", message: "" });
    const result = run(goodCase, { lint: { failed: false, byCase: { G1: [hit] } }, tests: incomplete });

    expect(result.rows[0]?.verdict).toBe("falsePositive");
  });

  it("数える対象の列の検査が完了しなかった誤った変更は slipped にせず undetermined とし、不合格にする", () => {
    const result = run(badCase, { tests: incomplete });

    expect(result.rows[0]?.verdict).toBe("undetermined");
    expect(result.passed).toBe(false);
  });

  it("数える対象でない列の検査が完了しなかっただけなら、誤った変更は slipped のまま", () => {
    const result = run(badCase, { types: incomplete });

    expect(result.rows[0]?.cells.types.state).toBe("na");
    expect(result.rows[0]?.verdict).toBe("slipped");
  });

  it("数える対象の列で検出があれば、他の列の検査が完了しなくても detected", () => {
    const hit = /** @type {Detection} */ ({ mechanism: "lint", file: "a.ts", line: 1, label: "rule", message: "" });
    const result = run(badCase, { lint: { failed: false, byCase: { B1: [hit] } }, tests: incomplete });

    expect(result.rows[0]?.verdict).toBe("detected");
    expect(result.passed).toBe(true);
  });
});
