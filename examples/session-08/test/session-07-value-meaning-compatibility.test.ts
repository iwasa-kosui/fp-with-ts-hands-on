import { expect, it } from "vitest";

import { Appointment } from "../src/domain/appointment.js";
import { AppointmentId } from "../src/domain/appointmentId.js";
import { OwnerId, type OwnerId as OwnerIdValue } from "../src/domain/ownerId.js";
import { PetId } from "../src/domain/petId.js";
import { Timestamp } from "../src/domain/timestamp.js";

it("Session 07 の値の意味の契約を branded な予約入力でも保つ", () => {
  const petId = PetId.parse("22222222-2222-4222-8222-222222222222")._unsafeUnwrap();
  const ownerId = OwnerId.parse("33333333-3333-4333-8333-333333333333")._unsafeUnwrap();
  const scheduled = Appointment.book({
    appointmentId: AppointmentId.parse("11111111-1111-4111-8111-111111111111")._unsafeUnwrap(),
    petId,
    ownerId,
    scheduledAt: Timestamp.parse("2026-08-30T06:00:00.000Z")._unsafeUnwrap(),
  });

  // @ts-expect-error PetId cannot satisfy OwnerId.
  const invalidOwnerId: OwnerIdValue = petId;

  expect(scheduled.ownerId).toBe(ownerId);
  void invalidOwnerId;
});
