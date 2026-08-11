import { expect, it } from "vitest";

import { isTerminalState } from "../src/state-vocabulary.js";

it("会計済みの来院を終端状態として扱う", () => {
  expect(isTerminalState("Paid")).toBe(true);
  expect(isTerminalState("InExamination")).toBe(false);
});
