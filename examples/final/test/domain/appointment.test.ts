import { describe, expect, test } from "vitest";

import {
  Appointment,
  type Paid,
} from "../../src/domain/appointment/appointment.js";
import { AppointmentId } from "../../src/domain/appointment/appointmentId.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import type { EventContext } from "../../src/domain/aggregate/eventContext.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { OwnerId } from "../../src/domain/owner-id.js";
import { PaymentAmount } from "../../src/domain/appointment/paymentAmount.js";
import { PetId } from "../../src/domain/pet-id.js";
import { UserId } from "../../src/domain/user/userId.js";
import { VeterinarianId } from "../../src/domain/appointment/veterinarianId.js";
import { Sensitive } from "../../src/domain/shared/sensitive.js";

const appointmentId = AppointmentId.schema.parse(
  "11111111-1111-4111-8111-111111111111",
);
const petId = PetId.schema.parse("22222222-2222-4222-8222-222222222222");
const ownerId = OwnerId.schema.parse("33333333-3333-4333-8333-333333333333");
const veterinarianId = VeterinarianId.schema.parse(
  "44444444-4444-4444-8444-444444444444",
);
const actorUserId = UserId.schema.parse("55555555-5555-4555-8555-555555555555");
const scheduledAt = Timestamp.schema.parse("2026-08-30T06:00:00.000Z");
const paymentAmount = PaymentAmount.schema.parse(4800);
const visitReason = Sensitive.of("skin check");
const diagnosis = Sensitive.of("dermatitis");
const treatment = Sensitive.of("ointment");
const cancellationReason = Sensitive.of("owner request");

const context = (eventId: string, occurredAt: string): EventContext => ({
  eventId: EventId.schema.parse(eventId),
  occurredAt: Timestamp.schema.parse(occurredAt),
  actorUserId,
});

const bookedContext = context(
  "66666666-6666-4666-8666-666666666666",
  "2026-08-29T06:00:00.000Z",
);
const checkedInContext = context(
  "77777777-7777-4777-8777-777777777777",
  "2026-08-30T06:20:00.000Z",
);
const examinationContext = context(
  "88888888-8888-4888-8888-888888888888",
  "2026-08-30T06:30:00.000Z",
);
const paymentContext = context(
  "99999999-9999-4999-8999-999999999999",
  "2026-08-30T07:00:00.000Z",
);
const canceledContext = context(
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "2026-08-29T07:00:00.000Z",
);

const booked = Appointment.book(bookedContext)({
  appointmentId,
  petId,
  ownerId,
  scheduledAt,
  reason: visitReason,
});
const checkedIn = Appointment.checkIn(checkedInContext)(booked.aggregateState);
const examining = Appointment.startExamination(examinationContext)(
  checkedIn.aggregateState,
  veterinarianId,
);
const paid = Appointment.recordPayment(paymentContext)(examining.aggregateState, {
  diagnosis,
  treatment,
  amount: paymentAmount,
});

const paidAppointment: Paid = paid.aggregateState;

// @ts-expect-error Paid から診察を開始できません。
Appointment.startExamination(examinationContext)(paidAppointment, veterinarianId);

const rawPaymentInput = {
  diagnosis,
  treatment,
  amount: 4800,
};

// @ts-expect-error recordPayment へ raw number を渡せません。
Appointment.recordPayment(paymentContext)(examining.aggregateState, rawPaymentInput);

describe("appointment aggregate", () => {
  test("redacts every clinical free-text field when serialized", () => {
    const canceled = Appointment.cancel(canceledContext)(booked.aggregateState, cancellationReason);

    expect(JSON.stringify(booked.aggregateState)).not.toContain("skin check");
    expect(JSON.stringify(paid.aggregateState)).not.toContain("dermatitis");
    expect(JSON.stringify(paid.aggregateState)).not.toContain('"ointment"');
    expect(JSON.stringify(canceled.aggregateState)).not.toContain("owner request");
  });

  test("books a scheduled appointment event with the resulting state", () => {
    expect(booked).toEqual({
      kind: "AppointmentBooked",
      eventId: bookedContext.eventId,
      aggregateId: appointmentId,
      aggregateName: "Appointment",
      aggregateState: {
        kind: "Scheduled",
        appointmentId,
        petId,
        ownerId,
        scheduledAt,
        reason: visitReason,
      },
      eventName: "appointment.booked",
      eventPayload: { appointmentId },
      occurredAt: bookedContext.occurredAt,
      actorUserId,
    });
  });

  test("checks in a scheduled appointment event with the resulting state", () => {
    expect(checkedIn).toEqual({
      kind: "AppointmentCheckedIn",
      eventId: checkedInContext.eventId,
      aggregateId: appointmentId,
      aggregateName: "Appointment",
      aggregateState: {
        kind: "CheckedIn",
        appointmentId,
        petId,
        ownerId,
        scheduledAt,
        reason: visitReason,
        checkedInAt: checkedInContext.occurredAt,
      },
      eventName: "appointment.checked-in",
      eventPayload: { appointmentId },
      occurredAt: checkedInContext.occurredAt,
      actorUserId,
    });
  });

  test("starts an examination event with the resulting state", () => {
    expect(examining).toEqual({
      kind: "ExaminationStarted",
      eventId: examinationContext.eventId,
      aggregateId: appointmentId,
      aggregateName: "Appointment",
      aggregateState: {
        kind: "InExamination",
        appointmentId,
        petId,
        ownerId,
        scheduledAt,
        reason: visitReason,
        checkedInAt: checkedInContext.occurredAt,
        veterinarianId,
        examinationStartedAt: examinationContext.occurredAt,
      },
      eventName: "appointment.examination-started",
      eventPayload: { appointmentId, veterinarianId },
      occurredAt: examinationContext.occurredAt,
      actorUserId,
    });
  });

  test("records a payment event with the resulting state", () => {
    expect(paid).toEqual({
      kind: "PaymentRecorded",
      eventId: paymentContext.eventId,
      aggregateId: appointmentId,
      aggregateName: "Appointment",
      aggregateState: {
        kind: "Paid",
        appointmentId,
        petId,
        ownerId,
        scheduledAt,
        reason: visitReason,
        checkedInAt: checkedInContext.occurredAt,
        veterinarianId,
        examinationStartedAt: examinationContext.occurredAt,
        diagnosis,
        treatment,
        amount: paymentAmount,
        paidAt: paymentContext.occurredAt,
      },
      eventName: "appointment.payment-recorded",
      eventPayload: { appointmentId },
      occurredAt: paymentContext.occurredAt,
      actorUserId,
    });
  });

  test("cancels an appointment event with the resulting state", () => {
    const canceled = Appointment.cancel(canceledContext)(booked.aggregateState, cancellationReason);

    expect(canceled).toEqual({
      kind: "AppointmentCanceled",
      eventId: canceledContext.eventId,
      aggregateId: appointmentId,
      aggregateName: "Appointment",
      aggregateState: {
        kind: "Canceled",
        appointmentId,
        petId,
        ownerId,
        scheduledAt,
        reason: cancellationReason,
        canceledAt: canceledContext.occurredAt,
      },
      eventName: "appointment.canceled",
      eventPayload: { appointmentId },
      occurredAt: canceledContext.occurredAt,
      actorUserId,
    });
  });
});
