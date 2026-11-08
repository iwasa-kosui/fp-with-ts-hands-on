import { beforeAll, expect, it } from "vitest";

import { StartExaminationInput } from "../../../s03/exercises/guard/subjects/input.js";

beforeAll(() => {
  const rejected = StartExaminationInput.parse({
    appointmentId: "not-a-uuid",
    veterinarianId: "not-a-uuid",
  }).isErr();
  if (rejected) {
    throw new Error("準備で失敗します");
  }
});

it("準備のあとで確かめる", () => {
  expect(1 + 1).toBe(2);
});
