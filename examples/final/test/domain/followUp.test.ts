import { describe, expect, test } from "vitest";

import { EventId } from "../../src/domain/aggregate/eventId.js";
import type { EventContext } from "../../src/domain/aggregate/eventContext.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { Appointment, type Appointment as AppointmentState } from "../../src/domain/appointment/appointment.js";
import { AppointmentId } from "../../src/domain/appointment/appointmentId.js";
import { AppointmentReason } from "../../src/domain/appointment/appointmentReason.js";
import { Diagnosis } from "../../src/domain/appointment/diagnosis.js";
import { PaymentAmount } from "../../src/domain/appointment/paymentAmount.js";
import { Treatment } from "../../src/domain/appointment/treatment.js";
import { VeterinarianId } from "../../src/domain/appointment/veterinarianId.js";
import { ExamId } from "../../src/domain/examResult/examId.js";
import { ExamResult, type ExamResult as ExamResultValue } from "../../src/domain/examResult/examResult.js";
import {
  collectFollowUpTargets,
  type FollowUpCandidate,
} from "../../src/domain/followUp/collectFollowUpTargets.js";
import { Owner } from "../../src/domain/owner/owner.js";
import { OwnerId } from "../../src/domain/owner/ownerId.js";
import { PetId } from "../../src/domain/pet/petId.js";
import { UserId } from "../../src/domain/user/userId.js";

const appointmentId = AppointmentId.schema.parse("11111111-1111-4111-8111-111111111111");
const ownerId = OwnerId.schema.parse("33333333-3333-4333-8333-333333333333");
const petId = PetId.schema.parse("22222222-2222-4222-8222-222222222222");
const otherPetId = PetId.schema.parse("44444444-4444-4444-8444-444444444444");
const veterinarianId = VeterinarianId.schema.parse(
  "55555555-5555-4555-8555-555555555555",
);
const actorUserId = UserId.schema.parse("66666666-6666-4666-8666-666666666666");
const scheduledAt = Timestamp.schema.parse("2026-08-30T06:00:00.000Z");
const paymentAmount = PaymentAmount.schema.parse(4800);

const context = (eventId: string, occurredAt: string): EventContext => ({
  eventId: EventId.schema.parse(eventId),
  occurredAt: Timestamp.schema.parse(occurredAt),
  actorUserId,
});

const owner = Owner.parse({
  ownerId,
  name: "Owner A",
  email: "owner@example.test",
  phone: "090-0000-0000",
})._unsafeUnwrap();

const paidAppointment = (() => {
  const booked = Appointment.book(context("77777777-7777-4777-8777-777777777777", "2026-08-29T06:00:00.000Z"))({
    appointmentId,
    ownerId,
    petId,
    scheduledAt,
    reason: AppointmentReason.schema.parse("skin check"),
  });
  const checkedIn = Appointment.checkIn(
    context("88888888-8888-4888-8888-888888888888", "2026-08-30T06:20:00.000Z"),
  )(booked.aggregateState);
  const examining = Appointment.startExamination(
    context("99999999-9999-4999-8999-999999999999", "2026-08-30T06:30:00.000Z"),
  )(checkedIn.aggregateState, veterinarianId);
  const completed = Appointment.completeExamination(
    context("ffffffff-ffff-4fff-8fff-ffffffffffff", "2026-08-30T06:45:00.000Z"),
  )(examining.aggregateState, {
    examId: ExamId.schema.parse("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"),
  });

  return Appointment.recordPayment(
    context("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "2026-08-30T07:00:00.000Z"),
  )(completed.aggregateState, {
    diagnosis: Diagnosis.schema.parse("skin inflammation"),
    treatment: Treatment.schema.parse("ointment"),
    amount: paymentAmount,
  }).aggregateState;
})();

const scheduledAppointment = Appointment.book(
  context("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "2026-08-29T06:00:00.000Z"),
)({
  appointmentId,
  ownerId,
  petId,
  scheduledAt,
  reason: AppointmentReason.schema.parse("skin check"),
}).aggregateState;

const candidate = (
  _eventId: string,
  examResult: ExamResultValue,
  appointment: AppointmentState = paidAppointment,
): FollowUpCandidate => ({
  appointment,
  owner,
  examResult,
});

const needsFollowUp = ExamResult.parse({
  examId: ExamId.schema.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
  petId,
  collectedAt: Timestamp.schema.parse("2026-08-30T06:45:00.000Z"),
  items: ["skin inflammation"],
  needsFollowUp: true,
})._unsafeUnwrap();

describe("follow-up target collection", () => {
  test("filters to paid appointments that need a follow-up and deduplicates appointment IDs", () => {
    const targets = collectFollowUpTargets([
      candidate("cccccccc-cccc-4ccc-8ccc-cccccccccccc", needsFollowUp),
      candidate("dddddddd-dddd-4ddd-8ddd-dddddddddddd", needsFollowUp),
      candidate(
        "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        ExamResult.parse({
          examId: ExamId.schema.parse("ffffffff-ffff-4fff-8fff-ffffffffffff"),
          petId,
          collectedAt: Timestamp.schema.parse("2026-08-30T06:45:00.000Z"),
          items: ["no action"],
          needsFollowUp: false,
        })._unsafeUnwrap(),
      ),
      candidate("ffffffff-ffff-4fff-8fff-ffffffffffff", needsFollowUp, scheduledAppointment),
    ]);

    expect(targets.isOk()).toBe(true);
    expect(targets._unsafeUnwrap()).toHaveLength(1);
    expect(targets._unsafeUnwrap()[0]).toMatchObject({
      appointmentId,
      petId,
    });
    expect(targets._unsafeUnwrap()[0]).not.toHaveProperty("event");
  });

  test("returns an error for the whole candidate set when any examination belongs to another pet", () => {
    const mismatched = ExamResult.parse({
      examId: ExamId.schema.parse("ffffffff-ffff-4fff-8fff-ffffffffffff"),
      petId: otherPetId,
      collectedAt: Timestamp.schema.parse("2026-08-30T06:45:00.000Z"),
      items: ["requires a call"],
      needsFollowUp: true,
    })._unsafeUnwrap();

    const targets = collectFollowUpTargets([
      candidate("cccccccc-cccc-4ccc-8ccc-cccccccccccc", needsFollowUp),
      candidate("dddddddd-dddd-4ddd-8ddd-dddddddddddd", mismatched),
    ]);

    expect(targets).toMatchObject({
      isErr: expect.any(Function),
      error: {
        kind: "ExamResultPetMismatch",
        appointmentId,
        expectedPetId: petId,
        actualPetId: otherPetId,
      },
    });
  });
});
