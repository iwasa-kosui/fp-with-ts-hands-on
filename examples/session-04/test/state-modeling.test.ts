import { describe, expect, it } from "vitest";

import { Appointment } from "../src/domain/appointment.js";
import { AppointmentId } from "../src/domain/appointment-id.js";
import { OwnerId } from "../src/domain/owner-id.js";
import { PetId } from "../src/domain/pet-id.js";
import { VeterinarianId } from "../src/domain/veterinarian-id.js";

const appointmentId = AppointmentId.parse("11111111-1111-4111-8111-111111111111")._unsafeUnwrap();
const petId = PetId.parse("22222222-2222-4222-8222-222222222222")._unsafeUnwrap();
const ownerId = OwnerId.parse("33333333-3333-4333-8333-333333333333")._unsafeUnwrap();
const veterinarianId = VeterinarianId.parse("44444444-4444-4444-8444-444444444444")._unsafeUnwrap();

const scheduled = Appointment.book({
  appointmentId,
  petId,
  ownerId,
  scheduledAt: "2026-08-30T06:30:00.000Z",
  reason: "skin check",
});
const checkedIn = Appointment.checkIn(scheduled, "2026-08-30T06:20:00.000Z");
const examining = Appointment.startExamination(
  checkedIn,
  veterinarianId,
  "2026-08-30T06:30:00.000Z",
);
const paid = Appointment.recordPayment(
  examining,
  { diagnosis: "dermatitis", treatment: "ointment", amount: 4800 },
  "2026-08-30T07:00:00.000Z",
);
const canceledAt = "2026-08-29T10:00:00.000Z";
const followUpRequestedAt = "2026-09-15T00:00:00.000Z";

// @ts-expect-error Paid から診察を開始できません。
Appointment.startExamination(paid, veterinarianId, "2026-08-30T07:10:00.000Z");

// @ts-expect-error Paid はキャンセルできません。
Appointment.cancelWithReason(paid, "owner-request", canceledAt, followUpRequestedAt);

describe("Session 04 state modeling", () => {
  it("予約から会計まで、用途別 ID を保ったまま状態に必要な情報を積み上げる", () => {
    expect(paid).toEqual({
      kind: "Paid",
      appointmentId: "11111111-1111-4111-8111-111111111111",
      petId: "22222222-2222-4222-8222-222222222222",
      ownerId: "33333333-3333-4333-8333-333333333333",
      scheduledAt: "2026-08-30T06:30:00.000Z",
      reason: "skin check",
      checkedInAt: "2026-08-30T06:20:00.000Z",
      veterinarianId: "44444444-4444-4444-8444-444444444444",
      examinationStartedAt: "2026-08-30T06:30:00.000Z",
      diagnosis: "dermatitis",
      treatment: "ointment",
      amount: 4800,
      paidAt: "2026-08-30T07:00:00.000Z",
    });
  });

  it("Scheduled と CheckedIn だけを理由付きでキャンセルでき、終端状態を判定する", () => {
    const canceled = Appointment.cancelWithReason(
      checkedIn,
      "owner-request",
      canceledAt,
      followUpRequestedAt,
    );

    expect(canceled).toEqual({
      kind: "Canceled",
      appointmentId: "11111111-1111-4111-8111-111111111111",
      petId: "22222222-2222-4222-8222-222222222222",
      ownerId: "33333333-3333-4333-8333-333333333333",
      scheduledAt: "2026-08-30T06:30:00.000Z",
      reason: "skin check",
      cancellationReason: "owner-request",
      canceledAt,
      followUpRequestedAt,
    });
    expect(Appointment.isTerminal(scheduled)).toBe(false);
    expect(Appointment.isTerminal(checkedIn)).toBe(false);
    expect(Appointment.isTerminal(examining)).toBe(false);
    expect(Appointment.isTerminal(paid)).toBe(true);
    expect(Appointment.isTerminal(canceled)).toBe(true);
  });
});
