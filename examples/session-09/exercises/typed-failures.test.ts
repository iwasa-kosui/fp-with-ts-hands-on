import { expect, it } from "vitest";

import { AppointmentId } from "../src/domain/appointmentId.js";
import { Appointment } from "../src/domain/appointment.js";
import { OwnerId } from "../src/domain/ownerId.js";
import { PetId } from "../src/domain/petId.js";
import { ensureCheckedIn, ensureFound } from "../src/domain/startExaminationErrors.js";
import { Timestamp } from "../src/domain/timestamp.js";

it("見つからない予約を AppointmentNotFound として返す", () => {
  const appointmentId = AppointmentId.schema.parse("11111111-1111-4111-8111-111111111111");

  const failed = ensureFound(undefined, appointmentId);
  const events: readonly unknown[] = [];

  expect(failed.isErr() && failed.error.kind).toBe("AppointmentNotFound");
  expect(events).toEqual([]);
});

it("受付前の予約を InvalidAppointmentState として返す", () => {
  const scheduled = Appointment.book({
    appointmentId: AppointmentId.schema.parse("11111111-1111-4111-8111-111111111111"),
    petId: PetId.schema.parse("22222222-2222-4222-8222-222222222222"),
    ownerId: OwnerId.schema.parse("33333333-3333-4333-8333-333333333333"),
    scheduledAt: Timestamp.schema.parse("2026-08-30T06:00:00.000Z"),
  });

  const failed = ensureCheckedIn(scheduled);

  expect(failed._unsafeUnwrapErr()).toEqual({
    kind: "InvalidAppointmentState",
    appointmentId: scheduled.appointmentId,
    actualKind: "Scheduled",
    expectedKind: "CheckedIn",
  });
});
