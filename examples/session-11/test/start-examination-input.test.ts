import { describe, expect, it } from "vitest";

import { StartExaminationInput } from "../src/domain/startExaminationInput.js";

describe("StartExaminationInput", () => {
  it("不正な予約 ID を SchemaValidationError として拒否する", () => {
    const result = StartExaminationInput.parse({
      appointmentId: "not-a-uuid",
      veterinarianId: "44444444-4444-4444-8444-444444444444",
      startedAt: "2026-08-30T06:30:00.000Z",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().kind).toBe("SchemaValidationError");
  });

  it("不正な日時を拒否する", () => {
    expect(
      StartExaminationInput.parse({
        appointmentId: "11111111-1111-4111-8111-111111111111",
        veterinarianId: "44444444-4444-4444-8444-444444444444",
        startedAt: "not-a-timestamp",
      }).isErr(),
    ).toBe(true);
  });

  it("有効な外部入力を一方向に変換する", () => {
    const raw = {
      appointmentId: "11111111-1111-4111-8111-111111111111",
      veterinarianId: "44444444-4444-4444-8444-444444444444",
      startedAt: "2026-08-30T06:30:00.000Z",
    };

    expect(StartExaminationInput.parse(raw)._unsafeUnwrap()).toEqual(raw);
  });
});
