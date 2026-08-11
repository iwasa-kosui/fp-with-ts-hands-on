import { expect, it } from "vitest";

import { Appointment } from "../src/domain/appointment.js";
import { AppointmentId } from "../src/domain/appointmentId.js";
import { OwnerId } from "../src/domain/ownerId.js";
import { PetId } from "../src/domain/petId.js";
import { Timestamp } from "../src/domain/timestamp.js";

it("予約作成で ID と日時の意味を保つ", () => {
  const appointmentId = AppointmentId.schema.parse("11111111-1111-4111-8111-111111111111");
  const petId = PetId.schema.parse("22222222-2222-4222-8222-222222222222");
  const ownerId = OwnerId.schema.parse("33333333-3333-4333-8333-333333333333");
  const scheduledAt = Timestamp.schema.parse("2026-08-30T06:00:00.000Z");

  const scheduled = Appointment.book({ appointmentId, petId, ownerId, scheduledAt });

  if (false) {
    // @ts-expect-error PetId cannot satisfy Appointment.book's ownerId.
    Appointment.book({ appointmentId, petId, ownerId: petId, scheduledAt });
  }

  expect(scheduled.ownerId).toBe(ownerId);
});
