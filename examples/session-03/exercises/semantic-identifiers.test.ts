import { describe, expect, expectTypeOf, it } from "vitest";

import { startExamination } from "../src/domain/appointment/transitions.js";
import { AppointmentId } from "../src/domain/ids/appointmentId.js";
import type { AppointmentId as AppointmentIdValue } from "../src/domain/ids/appointmentId.js";
import type { VeterinarianId } from "../src/domain/ids/veterinarianId.js";

describe("Step 1", () => {
  it("AppointmentId を VeterinarianId の用途へ渡せない", () => {
    expectTypeOf<AppointmentIdValue>().not.toMatchTypeOf<VeterinarianId>(); // 要件: AppointmentId を VeterinarianId の用途へ渡せない型にしてください。
  });
});

describe("Step 2", () => {
  it("診察開始には VeterinarianId が必要", () => {
    expectTypeOf<AppointmentIdValue>().not.toMatchTypeOf<Parameters<typeof startExamination>[1]>(); // 要件: 診察開始の担当獣医師に AppointmentId を渡せない型にしてください。
  });
});

describe("Step 3", () => {
  it("VeterinarianId を AppointmentId の用途へ渡せない", () => {
    expectTypeOf<VeterinarianId>().not.toMatchTypeOf<AppointmentIdValue>(); // 要件: VeterinarianId を AppointmentId の用途へ渡せない型にしてください。
  });
});

describe("回帰条件: 識別子は形式検査を通った値からしか作れない", () => {
  it("UUIDでない文字列からAppointmentIdを作れない", () => {
    expect(() => AppointmentId.parse("not-a-uuid")).toThrow();
  });
});
