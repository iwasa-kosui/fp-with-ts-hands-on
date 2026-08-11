import { expect, it } from "vitest";

import { StartExaminationInput } from "../src/domain/startExaminationInput.js";

it("外部からの診察開始入力で不正な UUID を拒否する", () => {
  const result = StartExaminationInput.parse({
    appointmentId: "11111111-1111-4111-8111-111111111111",
    veterinarianId: "not-a-uuid",
    startedAt: "2026-08-30T06:30:00.000Z",
  });

  expect(result.isErr()).toBe(true);
  expect(result._unsafeUnwrapErr().kind).toBe("SchemaValidationError");
});
