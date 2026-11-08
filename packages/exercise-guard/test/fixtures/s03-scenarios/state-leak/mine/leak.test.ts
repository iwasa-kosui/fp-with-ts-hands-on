import { expect, it } from "vitest";

import { StartExaminationInput } from "../../../s03/exercises/guard/subjects/input.js";
import { okCallCount } from "../../../s03/src/shared/schemaResult.js";

const shared = globalThis as { guardRuns?: number };
shared.guardRuns = (shared.guardRuns ?? 0) + 1;

it("モジュールの中の状態は、ケースごとに初期状態から始まる", () => {
  StartExaminationInput.parse({
    appointmentId: "11111111-1111-4111-8111-111111111111",
    veterinarianId: "44444444-4444-4444-8444-444444444444",
  });
  expect(okCallCount()).toBe(1);
});

it("globalThis のキーは、ケースごとに初期状態から始まる", () => {
  expect(shared.guardRuns).toBe(1);
});
