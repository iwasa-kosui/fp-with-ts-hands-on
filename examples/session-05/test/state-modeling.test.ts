import { describe, expect, it } from "vitest";

import { Appointment } from "../src/domain/appointment.js";
import { AppointmentId } from "../src/domain/appointment-id.js";
import { OwnerId } from "../src/domain/owner-id.js";
import { PetId } from "../src/domain/pet-id.js";
import { Timestamp } from "../src/domain/timestamp.js";
import { VeterinarianId } from "../src/domain/veterinarian-id.js";

const appointmentId = AppointmentId.parse("11111111-1111-4111-8111-111111111111")._unsafeUnwrap();
const petId = PetId.parse("22222222-2222-4222-8222-222222222222")._unsafeUnwrap();
const ownerId = OwnerId.parse("33333333-3333-4333-8333-433333333333")._unsafeUnwrap();
const veterinarianId = VeterinarianId.parse("44444444-4444-4444-8444-444444444444")._unsafeUnwrap();
const scheduledAt = Timestamp.parse("2026-08-30T06:00:00.000Z")._unsafeUnwrap();
const checkedInAt = Timestamp.parse("2026-08-30T06:20:00.000Z")._unsafeUnwrap();
const startedAt = Timestamp.parse("2026-08-30T06:30:00.000Z")._unsafeUnwrap();
const paidAt = Timestamp.parse("2026-08-30T07:00:00.000Z")._unsafeUnwrap();

const scheduled = Appointment.book({
  appointmentId,
  petId,
  ownerId,
  scheduledAt,
  reason: "skin check",
});
const checkedIn = Appointment.checkIn(scheduled, checkedInAt);
const examining = Appointment.startExamination(checkedIn, veterinarianId, startedAt);
const paid = Appointment.recordPayment(
  examining,
  { diagnosis: "dermatitis", treatment: "ointment", amount: 4800 },
  paidAt,
);

// @ts-expect-error Paid から診察を開始できません。
Appointment.startExamination(paid, veterinarianId, startedAt);

describe("Session 05 state modeling", () => {
  it("予約から会計まで用途別 ID と検証済みの時刻を保つ", () => {
    expect(paid).toMatchObject({
      kind: "Paid",
      appointmentId: "11111111-1111-4111-8111-111111111111",
      petId: "22222222-2222-4222-8222-222222222222",
      ownerId: "33333333-3333-4333-8333-433333333333",
      scheduledAt: "2026-08-30T06:00:00.000Z",
      checkedInAt: "2026-08-30T06:20:00.000Z",
      examinationStartedAt: "2026-08-30T06:30:00.000Z",
      paidAt: "2026-08-30T07:00:00.000Z",
    });
  });

  it("終了状態を診察中として扱わない", () => {
    expect(Appointment.isTerminal(scheduled)).toBe(false);
    expect(Appointment.isTerminal(paid)).toBe(true);
  });

  it("Canceled にキャンセル理由と任意の再診希望時刻だけを保持する", () => {
    const followUpRequestedAt = Timestamp.parse(
      "2026-09-15T00:00:00.000Z",
    )._unsafeUnwrap();
    const canceled = Appointment.cancelWithReason(
      checkedIn,
      "owner-request",
      startedAt,
      followUpRequestedAt,
    );

    expect(canceled).toMatchObject({
      kind: "Canceled",
      reason: "owner-request",
      canceledAt: "2026-08-30T06:30:00.000Z",
      followUpRequestedAt: "2026-09-15T00:00:00.000Z",
    });
    expect(canceled).not.toHaveProperty("cancellationReason");
    expect(canceled).not.toHaveProperty("checkedInAt");
  });
});
