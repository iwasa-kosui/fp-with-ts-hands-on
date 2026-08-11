import { expect, it } from "vitest";

import { visitLifecycle } from "../src/visit-lifecycle.js";

it("会計待ちを含む来院状態を表現できる", () => {
  expect(visitLifecycle.states).toEqual([
    "Scheduled",
    "CheckedIn",
    "InExamination",
    "AwaitingPayment",
    "Paid",
    "Canceled",
  ]);
});
