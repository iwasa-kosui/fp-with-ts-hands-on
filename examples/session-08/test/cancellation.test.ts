import { describe, expect, it } from "vitest";
import { Appointment } from "../src/domain/appointment.js";

describe("Session 06 cancellation", () => {
  it("予約済みまたは受付済みだけをキャンセルし、終端状態を判定する", () => {
    const scheduled = Appointment.book({ appointmentId: "appointment-1", petId: "pet-1", ownerId: "owner-1", scheduledAt: "2026-08-30T06:30:00.000Z" });
    const checkedIn = Appointment.checkIn(scheduled, "2026-08-30T06:20:00.000Z");
    const canceled = Appointment.cancel(checkedIn, { reason: "owner-request", now: "2026-08-29T10:00:00.000Z" });
    const examining = Appointment.startExamination(checkedIn, "vet-1", "2026-08-30T06:30:00.000Z");
    const paid = Appointment.recordPayment(
      Appointment.completeExamination(examining, {
        examId: "exam-1",
        now: "2026-08-30T06:50:00.000Z",
      }),
      { amount: 4_800 },
      "2026-08-30T07:00:00.000Z",
    );

    if (false) {
      // @ts-expect-error 診察中はキャンセルできません。
      Appointment.cancel(examining, { reason: "owner-request", now: "2026-08-30T06:35:00.000Z" });
    }
    expect(Appointment.isTerminal(scheduled)).toBe(false);
    expect(Appointment.isTerminal(paid)).toBe(true);
    expect(Appointment.isTerminal(canceled)).toBe(true);
  });
});
