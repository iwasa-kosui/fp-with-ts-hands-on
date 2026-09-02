import { describe, expect, expectTypeOf, it } from "vitest";

import { clinicFixture } from "../../fixtures/clinic.js";
import {
  StartExaminationInput,
  type StartExaminationInput as StartExaminationInputValue,
} from "../src/boundary/startExaminationInput.js";

describe("Step 1: HTTP入力を診察開始の入力へ変換する", () => {
  it("正しい予約IDと獣医師IDを型付き入力へ変換する", () => {
    const result = StartExaminationInput.parse({
      appointmentId: clinicFixture.appointmentId,
      veterinarianId: clinicFixture.veterinarianId,
    });

    expect(result.isOk()).toBe(true);
    expectTypeOf(result._unsafeUnwrap()).toMatchTypeOf<StartExaminationInputValue>();
  });
});

describe("Step 2: 不正なIDを境界で拒否する", () => {
  it("不正な予約IDをerrにする", () => {
    expect(
      StartExaminationInput.parse({
        appointmentId: "invalid",
        veterinarianId: clinicFixture.veterinarianId,
      }).isErr(),
    ).toBe(true);
  });

  it("不正な獣医師IDをerrにする", () => {
    expect(
      StartExaminationInput.parse({
        appointmentId: clinicFixture.appointmentId,
        veterinarianId: "night-shift",
      }).isErr(),
    ).toBe(true);
  });
});
