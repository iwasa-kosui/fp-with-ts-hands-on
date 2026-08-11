import { describe, expect, it } from "vitest";
import { Appointment } from "../src/domain/appointment.js";

describe("Session 05 awaiting payment", () => {
  it("診察完了後だけを会計待ちから会計済みへ進める", () => {
    const scheduled = Appointment.book({ appointmentId: "appointment-1", petId: "pet-1", ownerId: "owner-1", scheduledAt: "2026-08-30T06:30:00.000Z" });
    const examining = Appointment.startExamination(Appointment.checkIn(scheduled, "2026-08-30T06:20:00.000Z"), "vet-1", "2026-08-30T06:30:00.000Z");
    const completed = Appointment.completeExamination(examining, { examId: "exam-1", now: "2026-08-30T06:50:00.000Z" });
    const paid = Appointment.recordPayment(completed, { amount: 4_800 }, "2026-08-30T07:00:00.000Z");

    if (false) {
      // @ts-expect-error 会計待ち前に会計できない。
      Appointment.recordPayment(examining, { amount: 4_800 }, "2026-08-30T07:00:00.000Z");
    }
    expect(paid.kind).toBe("Paid");
  });
});
