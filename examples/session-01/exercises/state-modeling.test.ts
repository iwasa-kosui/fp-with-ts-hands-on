import { expect, it } from "vitest";

import { visitLifecycle } from "../src/visit-lifecycle.js";

it("会計済みの来院を終端状態として扱う", () => {
  expect(visitLifecycle.terminalStates).toEqual(["Paid"]);
});
