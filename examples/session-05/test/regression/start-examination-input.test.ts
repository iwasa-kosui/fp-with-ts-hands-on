import { describe, expect, expectTypeOf, it } from "vitest";

import { clinicFixture } from "../../../fixtures/clinic.js";
import {
  StartExaminationInput,
  type StartExaminationInput as StartExaminationInputValue,
} from "../../src/boundary/startExaminationInput.js";

describe("S4 regression: 診察開始の外部入力を検証する", () => {
  it("正しい2つのIDを型付き入力へ変換する", () => {
    const result = StartExaminationInput.parse({
      appointmentId: clinicFixture.appointmentId,
      veterinarianId: clinicFixture.veterinarianId,
    });

    expect(result.isOk()).toBe(true);
    expectTypeOf(result._unsafeUnwrap()).toMatchTypeOf<StartExaminationInputValue>();
  });

  it("不正な予約IDを拒否する", () => {
    expect(
      StartExaminationInput.parse({
        appointmentId: "invalid",
        veterinarianId: clinicFixture.veterinarianId,
      }).isErr(),
    ).toBe(true);
  });

  it("不正な獣医師IDを拒否する", () => {
    expect(
      StartExaminationInput.parse({
        appointmentId: clinicFixture.appointmentId,
        veterinarianId: "invalid",
      }).isErr(),
    ).toBe(true);
  });
});
