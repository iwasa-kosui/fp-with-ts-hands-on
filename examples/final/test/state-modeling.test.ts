import { describe, expect, it } from "vitest";

import { Appointment } from "../src/domain/appointment.js";
import {
  checkedIn,
  paidAppointment,
  startedAt,
  veterinarianId,
} from "./fixtures.js";

// @ts-expect-error Paid から診察を開始できません。
Appointment.startExamination(paidAppointment, veterinarianId, startedAt);

describe("final state modeling", () => {
  it("CheckedIn から診察を開始し、状態固有の情報を必須で保持する", () => {
    const examining = Appointment.startExamination(checkedIn, veterinarianId, startedAt);

    expect(examining).toMatchObject({
      kind: "InExamination",
      appointmentId: "11111111-1111-4111-8111-111111111111",
      petId: "22222222-2222-4222-8222-222222222222",
      veterinarianId: "44444444-4444-4444-8444-444444444444",
      examinationStartedAt: "2026-08-30T06:30:00.000Z",
    });
  });

  it("Paid と Canceled だけを終了状態として判定する", () => {
    const canceled = Appointment.cancelWithReason(
      checkedIn,
      "owner request",
      startedAt,
      startedAt,
    );

    expect(canceled).toMatchObject({
      kind: "Canceled",
      reason: "owner request",
      followUpRequestedAt: "2026-08-30T06:30:00.000Z",
    });
    expect(canceled).not.toHaveProperty("cancellationReason");
    expect(canceled).not.toHaveProperty("checkedInAt");
    expect(Appointment.isTerminal(checkedIn)).toBe(false);
    expect(Appointment.isTerminal(paidAppointment)).toBe(true);
    expect(Appointment.isTerminal(canceled)).toBe(true);
  });
});
