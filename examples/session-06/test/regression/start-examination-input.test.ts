import { describe, expect, expectTypeOf, it } from "vitest";

import { clinicFixture } from "../../../fixtures/clinic.js";
import {
  StartExaminationInput,
  type StartExaminationInput as StartExaminationInputValue,
} from "../../src/boundary/startExaminationInput.js";

const validationIssuesOf = (result: unknown): unknown => {
  if (typeof result !== "object" || result === null) return undefined;
  const unwrap = Reflect.get(result, "_unsafeUnwrapErr");
  return typeof unwrap === "function" ? Reflect.apply(unwrap, result, []) : undefined;
};

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

  it("不正な2項目のpathを検証結果へ残す", () => {
    const result = StartExaminationInput.parse({
      appointmentId: "not-an-appointment-id",
      veterinarianId: "night-shift",
    });

    expect(validationIssuesOf(result)).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ["appointmentId"] }),
      expect.objectContaining({ path: ["veterinarianId"] }),
    ]));
  });
});
