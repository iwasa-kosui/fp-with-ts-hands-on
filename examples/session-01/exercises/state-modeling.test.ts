import { expect, it } from "vitest";

it("診察開始と理由付きキャンセルを表現できる", async () => {
  const { Appointment } = await import("../src/domain/appointment.js");
  const scheduled = Appointment.book({
    appointmentId: "11111111-1111-4111-8111-111111111111",
    petId: "22222222-2222-4222-8222-222222222222",
    ownerId: "33333333-3333-4333-8333-333333333333",
    scheduledAt: "2026-08-30T06:30:00.000Z",
    reason: "skin check",
  });
  const checkedIn = Appointment.checkIn(scheduled, "2026-08-30T06:20:00.000Z");
  const examining = Appointment.startExamination(
    checkedIn,
    "44444444-4444-4444-8444-444444444444",
    "2026-08-30T06:30:00.000Z",
  );
  const canceled = Appointment.cancelWithReason(
    scheduled,
    "owner-request",
    "2026-08-29T10:00:00.000Z",
    "2026-09-15T00:00:00.000Z",
  );

  expect(examining.kind).toBe("InExamination");
  expect(canceled).toMatchObject({
    kind: "Canceled",
    reason: "owner-request",
    canceledAt: "2026-08-29T10:00:00.000Z",
    followUpRequestedAt: "2026-09-15T00:00:00.000Z",
  });
  expect(canceled).not.toHaveProperty("cancellationReason");
});
