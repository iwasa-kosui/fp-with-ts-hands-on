import { describe, expect, it } from "vitest";

import { AppointmentId } from "../src/domain/ids/appointmentId.js";
import {
  assertAppointmentAndVeterinarianIdsCannotBeMixed,
  assertInvalidIdentifierAssignmentsAreRejected,
  assertStartExaminationRequiresPurposeSpecificIds,
} from "./typeRequirements.js";

describe("Step 1", () => {
  it("予約と獣医師の識別子を取り違えられない", () => {
    assertAppointmentAndVeterinarianIdsCannotBeMixed();
  });
});

describe("Step 2", () => {
  it("診察開始には予約と獣医師それぞれの識別子が必要", () => {
    assertStartExaminationRequiresPurposeSpecificIds();
  });
});

describe("Step 3", () => {
  it("不正な識別子の取り違えを少なくとも2か所で止める", () => {
    assertInvalidIdentifierAssignmentsAreRejected();
  });
});

describe("回帰条件: 識別子は形式検査を通った値からしか作れない", () => {
  it("UUIDでない文字列からAppointmentIdを作れない", () => {
    expect(() => AppointmentId.parse("not-a-uuid")).toThrow();
  });
});
