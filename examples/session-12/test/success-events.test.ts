import { expect, it } from "vitest";

import { Appointment } from "../src/domain/appointment.js";
import { AppointmentId } from "../src/domain/appointmentId.js";
import { OwnerId } from "../src/domain/ownerId.js";
import { PetId } from "../src/domain/petId.js";
import { Timestamp } from "../src/domain/timestamp.js";
import { VeterinarianId } from "../src/domain/veterinarianId.js";

it("診察開始の成功を状態変更イベントとして組み立てる", () => {
  const appointmentId = AppointmentId.schema.parse("11111111-1111-4111-8111-111111111111");
  const scheduled = Appointment.book({
    appointmentId,
    petId: PetId.schema.parse("22222222-2222-4222-8222-222222222222"),
    ownerId: OwnerId.schema.parse("33333333-3333-4333-8333-333333333333"),
    scheduledAt: Timestamp.schema.parse("2026-08-30T06:00:00.000Z"),
  });
  const checkedIn = Appointment.checkIn(scheduled, Timestamp.schema.parse("2026-08-30T06:10:00.000Z"));
  const veterinarianId = VeterinarianId.schema.parse("44444444-4444-4444-8444-444444444444");
  const context = { occurredAt: Timestamp.schema.parse("2026-08-30T06:30:00.000Z") };

  const event = Appointment.startExamination(context)(checkedIn, veterinarianId);

  expect(event).toEqual({
    kind: "AppointmentExaminationStarted",
    aggregateId: appointmentId,
    aggregateName: "Appointment",
    aggregateState: {
      ...checkedIn,
      kind: "InExamination",
      veterinarianId,
      examinationStartedAt: context.occurredAt,
    },
    eventName: "appointment.examination-started",
    eventPayload: { appointmentId, veterinarianId },
    occurredAt: context.occurredAt,
  });
});
