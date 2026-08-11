import { expect, it } from "vitest";

import { Appointment } from "../src/domain/appointment.js";

it("診察を完了した来院だけを会計待ちへ進められる", () => {
  const scheduled = Appointment.book({
    appointmentId: "appointment-1",
    petId: "pet-1",
    ownerId: "owner-1",
    scheduledAt: "2026-08-30T06:30:00.000Z",
  });
  const checkedIn = Appointment.checkIn(scheduled, "2026-08-30T06:20:00.000Z");
  const examining = Appointment.startExamination(
    checkedIn,
    "vet-1",
    "2026-08-30T06:30:00.000Z",
  );
  const completed = Appointment.completeExamination(examining, {
    examId: "exam-1",
    now: "2026-08-30T06:50:00.000Z",
  });

  expect(completed.kind).toBe("AwaitingPayment");

  if (false) {
    // @ts-expect-error 会計待ち前に会計できません。
    Appointment.recordPayment(examining, { amount: 4_800 }, "2026-08-30T07:00:00.000Z");
  }
});
