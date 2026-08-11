import { describe, expect, it } from "vitest";
import { Appointment } from "../src/domain/appointment.js";
import { AppointmentId } from "../src/domain/appointmentId.js";
import { ExamId } from "../src/domain/examId.js";
import { OwnerId } from "../src/domain/ownerId.js";
import { PaymentAmount } from "../src/domain/paymentAmount.js";
import { PetId } from "../src/domain/petId.js";
import { Timestamp } from "../src/domain/timestamp.js";
import { VeterinarianId } from "../src/domain/veterinarianId.js";

describe("Session 06 cancellation", () => {
  it("予約済みまたは受付済みだけをキャンセルし、終端状態を判定する", () => {
    const scheduled = Appointment.book({ appointmentId: AppointmentId.schema.parse("11111111-1111-4111-8111-111111111111"), petId: PetId.schema.parse("22222222-2222-4222-8222-222222222222"), ownerId: OwnerId.schema.parse("33333333-3333-4333-8333-333333333333"), scheduledAt: Timestamp.schema.parse("2026-08-30T06:30:00.000Z") });
    const checkedIn = Appointment.checkIn(scheduled, Timestamp.schema.parse("2026-08-30T06:20:00.000Z"));
    const canceled = Appointment.cancel(checkedIn, { reason: "owner-request", now: Timestamp.schema.parse("2026-08-29T10:00:00.000Z") });
    const examining = Appointment.startExamination({ occurredAt: Timestamp.schema.parse("2026-08-30T06:30:00.000Z") })(checkedIn, VeterinarianId.schema.parse("44444444-4444-4444-8444-444444444444")).aggregateState;
    const paid = Appointment.recordPayment(
      Appointment.completeExamination(examining, {
        examId: ExamId.schema.parse("55555555-5555-4555-8555-555555555555"),
        now: Timestamp.schema.parse("2026-08-30T06:50:00.000Z"),
      }),
      { amount: PaymentAmount.schema.parse(4_800) },
      Timestamp.schema.parse("2026-08-30T07:00:00.000Z"),
    );

    if (false) {
      // @ts-expect-error 診察中はキャンセルできません。
      Appointment.cancel(examining, { reason: "owner-request", now: Timestamp.schema.parse("2026-08-30T06:35:00.000Z") });
    }
    expect(Appointment.isTerminal(scheduled)).toBe(false);
    expect(Appointment.isTerminal(paid)).toBe(true);
    expect(Appointment.isTerminal(canceled)).toBe(true);
  });
});
