import { describe, expect, test } from "vitest";

import {
  Appointment,
  type Paid,
} from "../../src/domain/appointment/appointment.js";
import { AppointmentId } from "../../src/domain/appointment/appointmentId.js";
import { AppointmentReason } from "../../src/domain/appointment/appointmentReason.js";
import { CancellationReason } from "../../src/domain/appointment/cancellationReason.js";
import { Diagnosis } from "../../src/domain/appointment/diagnosis.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import type { EventContext } from "../../src/domain/aggregate/eventContext.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { OwnerId } from "../../src/domain/owner/ownerId.js";
import { PaymentAmount } from "../../src/domain/appointment/paymentAmount.js";
import {
  Settlement,
  SettlementState,
  type DepositReceived,
  type NoPayment,
} from "../../src/domain/appointment/settlementState.js";
import { PetId } from "../../src/domain/pet/petId.js";
import { UserId } from "../../src/domain/user/userId.js";
import { VeterinarianId } from "../../src/domain/appointment/veterinarianId.js";
import { Treatment } from "../../src/domain/appointment/treatment.js";
import { ExamId } from "../../src/domain/examResult/examId.js";
import { ExamResultItem } from "../../src/domain/examResult/examResultItem.js";
import { AppointmentDuration } from "../../src/domain/appointment/appointmentDuration.js";
import { ReceptionNote } from "../../src/domain/appointment/receptionNote.js";
import { ServiceCode } from "../../src/domain/appointment/serviceCode.js";
import { SettlementAdjustmentAmount } from "../../src/domain/appointment/settlementAdjustmentAmount.js";

const appointmentId = AppointmentId.schema.parse(
  "11111111-1111-4111-8111-111111111111",
);
const petId = PetId.schema.parse("22222222-2222-4222-8222-222222222222");
const ownerId = OwnerId.schema.parse("33333333-3333-4333-8333-333333333333");
const veterinarianId = VeterinarianId.schema.parse(
  "44444444-4444-4444-8444-444444444444",
);
const actorUserId = UserId.schema.parse("55555555-5555-4555-8555-555555555555");
const examId = ExamId.schema.parse("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
const scheduledAt = Timestamp.schema.parse("2026-08-30T06:00:00.000Z");
const paymentAmount = PaymentAmount.schema.parse(4800);
const visitReason = AppointmentReason.schema.parse("skin check");
const diagnosis = Diagnosis.schema.parse("dermatitis");
const treatment = Treatment.schema.parse("ointment");
const cancellationReason = CancellationReason.schema.parse("owner request");
const settledAt = Timestamp.schema.parse("2026-08-30T07:10:00.000Z");
const noPayment = { kind: "NoPayment" } as const satisfies NoPayment;
const receivedDeposit = (depositAmount: number): DepositReceived => ({
  kind: "DepositReceived",
  depositAmount: PaymentAmount.schema.parse(depositAmount),
  receivedAt: Timestamp.schema.parse("2026-08-29T06:30:00.000Z"),
});

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
const completionContext = context(
  "abababab-abab-4bab-8bab-abababababab",
  "2026-08-30T06:50:00.000Z",
);
const paymentContext = context(
  "99999999-9999-4999-8999-999999999999",
  "2026-08-30T07:00:00.000Z",
);
const canceledContext = context(
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "2026-08-29T07:00:00.000Z",
);
const updatedContext = context(
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "2026-08-29T08:00:00.000Z",
);
const walkInContext = context(
  "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  "2026-08-30T08:00:00.000Z",
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
const awaitingPayment = Appointment.completeExamination(completionContext)(
  examining.aggregateState,
  { examId },
);
const paid = Appointment.recordPayment(paymentContext)(awaitingPayment.aggregateState, {
  diagnosis,
  treatment,
  amount: paymentAmount,
});

const paidAppointment: Paid = paid.aggregateState;

// @ts-expect-error Paid から診察を開始できません。
Appointment.startExamination(examinationContext)(paidAppointment, veterinarianId);

// @ts-expect-error InExamination から直接会計できません。
Appointment.recordPayment(paymentContext)(examining.aggregateState, {
  diagnosis,
  treatment,
  amount: paymentAmount,
});

const rawPaymentInput = {
  diagnosis,
  treatment,
  amount: 4800,
};

// @ts-expect-error recordPayment へ raw number を渡せません。
Appointment.recordPayment(paymentContext)(awaitingPayment.aggregateState, rawPaymentInput);

describe("appointment aggregate", () => {
  test("updates a reception note only while the appointment is active", () => {
    const note = ReceptionNote.schema.parse("handle in a quiet room");
    const updated = Appointment.updateReceptionNote(updatedContext)(
      awaitingPayment.aggregateState,
      note,
    );

    expect(updated).toMatchObject({
      kind: "AppointmentReceptionNoteUpdated",
      eventName: "appointment.reception-note-updated",
      aggregateState: { kind: "AwaitingPayment", version: 5 },
    });
    expect(updated.aggregateState.receptionNote?.unwrap()).toBe(
      "handle in a quiet room",
    );

    // @ts-expect-error Paid の受付メモは更新できません。
    Appointment.updateReceptionNote(updatedContext)(paid.aggregateState, note);
  });

  test("receives one positive deposit only for an eligible vaccination appointment", () => {
    const vaccination = Appointment.book(bookedContext)({
      appointmentId,
      petId,
      ownerId,
      scheduledAt,
      durationMinutes: AppointmentDuration.schema.parse(15),
      serviceCode: ServiceCode.schema.parse("Vaccination"),
      bookingKind: "Reserved",
      assignedVeterinarianId: null,
      visitReason,
      receptionNote: null,
      settlement: noPayment,
    }).aggregateState;
    const amount = PaymentAmount.schema.parse(7000);

    const received = Appointment.receiveDeposit(updatedContext)(vaccination, amount);

    expect(received._unsafeUnwrap()).toMatchObject({
      kind: "AppointmentDepositReceived",
      eventName: "appointment.deposit-received",
      aggregateState: {
        kind: "Scheduled",
        version: 2,
        settlement: {
          kind: "DepositReceived",
          depositAmount: amount,
          receivedAt: updatedContext.occurredAt,
        },
      },
    });
    expect(
      Appointment.receiveDeposit(updatedContext)(
        received._unsafeUnwrap().aggregateState,
        amount,
      )._unsafeUnwrapErr(),
    ).toMatchObject({ kind: "DepositAlreadyReceived" });
    expect(
      Appointment.receiveDeposit(updatedContext)(booked.aggregateState, amount)
        ._unsafeUnwrapErr(),
    ).toMatchObject({ kind: "DepositNotAllowed" });
  });

  test("does not allow an initial deposit to be injected while booking", () => {
    const inputWithInjectedSettlement = {
      appointmentId,
      petId,
      ownerId,
      scheduledAt,
      durationMinutes: AppointmentDuration.schema.parse(30),
      serviceCode: ServiceCode.schema.parse("GeneralConsultation"),
      bookingKind: "Reserved" as const,
      assignedVeterinarianId: null,
      visitReason,
      receptionNote: null,
      settlement: receivedDeposit(7000),
    };

    const event = Appointment.book(bookedContext)(
      inputWithInjectedSettlement as unknown as Parameters<
        ReturnType<typeof Appointment.book>
      >[0],
    );

    expect(event.aggregateState.settlement).toEqual({ kind: "NoPayment" });
  });

  test.each([
    { finalAmount: 9000, depositAmount: 7000, additionalPaymentAmount: 2000, refundAmount: 0 },
    { finalAmount: 7000, depositAmount: 7000, additionalPaymentAmount: 0, refundAmount: 0 },
    { finalAmount: 5000, depositAmount: 7000, additionalPaymentAmount: 0, refundAmount: 2000 },
  ])("accepts a mathematically consistent settled tuple %#", (amounts) => {
    expect(SettlementState.schema.safeParse({
      kind: "Settled",
      ...amounts,
      settledAt,
    }).success).toBe(true);
  });

  test.each([
    { finalAmount: 5000, depositAmount: 1000, additionalPaymentAmount: 9999, refundAmount: 0 },
    { finalAmount: 5000, depositAmount: 7000, additionalPaymentAmount: 0, refundAmount: 0 },
    { finalAmount: 7000, depositAmount: 7000, additionalPaymentAmount: 1, refundAmount: 1 },
  ])("rejects a mathematically impossible settled tuple %#", (amounts) => {
    expect(SettlementState.schema.safeParse({
      kind: "Settled",
      ...amounts,
      settledAt,
    }).success).toBe(false);
  });

  test.each([
    { final: 9000, additional: 2000, refund: 0 },
    { final: 7000, additional: 0, refund: 0 },
    { final: 5000, additional: 0, refund: 2000 },
  ])(
    "records the server-calculated final settlement for final=$final",
    ({ final, additional, refund }) => {
      const prepaid = {
        ...awaitingPayment.aggregateState,
        settlement: receivedDeposit(7000),
      } as const satisfies typeof awaitingPayment.aggregateState;
      const finalAmount = PaymentAmount.schema.parse(final);

      const settled = Appointment.settle(paymentContext)(prepaid, {
        diagnosis,
        treatment,
        finalAmount,
      });

      expect(settled).toMatchObject({
        kind: "AppointmentFinalSettlementRecorded",
        eventName: "appointment.final-settlement-recorded",
        aggregateState: {
          kind: "Paid",
          diagnosis,
          treatment,
          version: 5,
          settlement: {
            kind: "Settled",
            finalAmount,
            depositAmount: SettlementAdjustmentAmount.schema.parse(7000),
            additionalPaymentAmount:
              SettlementAdjustmentAmount.schema.parse(additional),
            refundAmount: SettlementAdjustmentAmount.schema.parse(refund),
            settledAt: paymentContext.occurredAt,
          },
        },
      });
    },
  );

  test("includes the full deposit refund in a prepaid cancellation event", () => {
    const prepaid = {
      ...booked.aggregateState,
      serviceCode: ServiceCode.schema.parse("Vaccination"),
      settlement: receivedDeposit(7000),
    } as const satisfies typeof booked.aggregateState;

    const canceled = Appointment.cancel(canceledContext)(prepaid, cancellationReason);

    expect(canceled).toMatchObject({
      eventPayload: {
        appointmentId,
        refundAmount: PaymentAmount.schema.parse(7000),
      },
      aggregateState: {
        kind: "Canceled",
        settlement: {
          kind: "DepositRefunded",
          depositAmount: PaymentAmount.schema.parse(7000),
          refundedAt: canceledContext.occurredAt,
        },
      },
    });
  });

  test("updates every editable field of a Scheduled appointment and increments its version", () => {
    const changedReason = AppointmentReason.schema.parse("changed private reason");
    const updated = Appointment.update(updatedContext)(booked.aggregateState, {
      ownerId,
      petId,
      scheduledAt: Timestamp.schema.parse("2026-08-30T09:00:00.000Z"),
      durationMinutes: AppointmentDuration.schema.parse(60),
      serviceCode: ServiceCode.schema.parse("ExaminationOrProcedure"),
      assignedVeterinarianId: veterinarianId,
      visitReason: changedReason,
    })._unsafeUnwrap();

    expect(updated).toMatchObject({
      kind: "AppointmentUpdated",
      eventName: "appointment.updated",
      eventId: updatedContext.eventId,
      aggregateState: {
        kind: "Scheduled",
        scheduledAt: "2026-08-30T09:00:00.000Z",
        durationMinutes: 60,
        serviceCode: "ExaminationOrProcedure",
        assignedVeterinarianId: veterinarianId,
        version: 2,
      },
    });
    expect(updated.aggregateState.visitReason.unwrap()).toBe("changed private reason");
  });

  test("rejects a service update that would make a received deposit ineligible", () => {
    const vaccination = Appointment.book(bookedContext)({
      appointmentId,
      petId,
      ownerId,
      scheduledAt,
      durationMinutes: AppointmentDuration.schema.parse(15),
      serviceCode: ServiceCode.schema.parse("Vaccination"),
      bookingKind: "Reserved",
      assignedVeterinarianId: null,
      visitReason,
      receptionNote: null,
      settlement: noPayment,
    }).aggregateState;
    const prepaid = Appointment.receiveDeposit(updatedContext)(
      vaccination,
      PaymentAmount.schema.parse(7000),
    )._unsafeUnwrap().aggregateState;
    if (prepaid.kind !== "Scheduled") {
      throw new TypeError("a deposit must preserve the scheduled state");
    }

    const result = Appointment.update(paymentContext)(prepaid, {
      ownerId,
      petId,
      scheduledAt,
      durationMinutes: AppointmentDuration.schema.parse(30),
      serviceCode: ServiceCode.schema.parse("GeneralConsultation"),
      assignedVeterinarianId: null,
      visitReason,
    });

    expect(result._unsafeUnwrapErr()).toEqual({
      kind: "DepositNotAllowed",
      appointmentId,
    });
  });

  test("registers a walk-in directly as CheckedIn with one server timestamp and version 1", () => {
    const walkIn = Appointment.registerWalkIn(walkInContext)({
      appointmentId,
      ownerId,
      petId,
      durationMinutes: AppointmentDuration.schema.parse(15),
      serviceCode: ServiceCode.schema.parse("Vaccination"),
      assignedVeterinarianId: null,
      visitReason,
      receptionNote: ReceptionNote.schema.parse("private reception note"),
    });

    expect(walkIn).toMatchObject({
      kind: "AppointmentWalkInRegistered",
      eventName: "appointment.walk-in-registered",
      aggregateState: {
        kind: "CheckedIn",
        scheduledAt: walkInContext.occurredAt,
        checkedInAt: walkInContext.occurredAt,
        bookingKind: "WalkIn",
        version: 1,
      },
    });
    expect(walkIn.aggregateState.receptionNote?.unwrap()).toBe("private reception note");
  });

  test("reassigns a veterinarian in Scheduled and CheckedIn while preserving the remaining state", () => {
    const scheduledReassigned = Appointment.reassignVeterinarian(updatedContext)(
      booked.aggregateState,
      veterinarianId,
    );
    const checkedInReassigned = Appointment.reassignVeterinarian(updatedContext)(
      checkedIn.aggregateState,
      null,
    );

    expect(scheduledReassigned).toMatchObject({
      kind: "AppointmentVeterinarianReassigned",
      eventName: "appointment.veterinarian-reassigned",
      aggregateState: { kind: "Scheduled", assignedVeterinarianId: veterinarianId, version: 2 },
    });
    expect(checkedInReassigned).toMatchObject({
      aggregateState: { kind: "CheckedIn", assignedVeterinarianId: null, version: 3 },
    });
  });

  test("carries operational fields and increments the version through the existing lifecycle", () => {
    expect(booked.aggregateState).toMatchObject({
      kind: "Scheduled",
      serviceCode: "GeneralConsultation",
      durationMinutes: 30,
      bookingKind: "Reserved",
      assignedVeterinarianId: null,
      receptionNote: null,
      settlement: { kind: "NoPayment" },
      version: 1,
    });
    expect(checkedIn.aggregateState).toMatchObject({ version: 2 });
    expect(examining.aggregateState).toMatchObject({
      assignedVeterinarianId: veterinarianId,
      version: 3,
    });
    expect(awaitingPayment.aggregateState).toMatchObject({ version: 4 });
    expect(paid.aggregateState).toMatchObject({
      version: 5,
      settlement: {
        kind: "Settled",
        finalAmount: 4800,
        depositAmount: 0,
        additionalPaymentAmount: 4800,
        refundAmount: 0,
        settledAt: paymentContext.occurredAt,
      },
    });
    expect(paid.aggregateState).not.toHaveProperty("amount");
    expect(paid.aggregateState).not.toHaveProperty("paidAt");
  });

  test("keeps the visit reason separate from the cancellation reason", () => {
    const canceled = Appointment.cancel(canceledContext)(booked.aggregateState, cancellationReason);

    expect(canceled.aggregateState).toMatchObject({
      kind: "Canceled",
      visitReason,
      cancellationReason,
      settlement: { kind: "NoPayment" },
      version: 2,
    });
  });

  test("settles a payment without a deposit as the additional payment", () => {
    expect(Settlement.settle(noPayment, PaymentAmount.schema.parse(5000), settledAt)).toMatchObject({
      kind: "Settled",
      depositAmount: 0,
      additionalPaymentAmount: 5000,
      refundAmount: 0,
    });
  });

  test("settles an excess deposit as a refund", () => {
    expect(
      Settlement.settle(receivedDeposit(7000), PaymentAmount.schema.parse(5000), settledAt),
    ).toMatchObject({
      kind: "Settled",
      depositAmount: 7000,
      additionalPaymentAmount: 0,
      refundAmount: 2000,
    });
  });

  test("keeps sensitive clinical values nominally distinct", () => {
    const examItem = ExamResultItem.schema.parse("skin observation");
    const acceptsAppointmentReason = (_value: typeof visitReason): void => undefined;
    const acceptsDiagnosis = (_value: typeof diagnosis): void => undefined;
    const acceptsTreatment = (_value: typeof treatment): void => undefined;

    if (false) {
      // @ts-expect-error CancellationReason cannot satisfy AppointmentReason.
      acceptsAppointmentReason(cancellationReason);
      // @ts-expect-error Treatment cannot satisfy Diagnosis.
      acceptsDiagnosis(treatment);
      // @ts-expect-error ExamResultItem cannot satisfy Treatment.
      acceptsTreatment(examItem);
    }

    expect(visitReason.unwrap()).not.toBe(cancellationReason.unwrap());
  });

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
        durationMinutes: 30,
        serviceCode: "GeneralConsultation",
        bookingKind: "Reserved",
        assignedVeterinarianId: null,
        visitReason,
        receptionNote: null,
        settlement: noPayment,
        version: 1,
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
        durationMinutes: 30,
        serviceCode: "GeneralConsultation",
        bookingKind: "Reserved",
        assignedVeterinarianId: null,
        visitReason,
        receptionNote: null,
        settlement: noPayment,
        version: 2,
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
        durationMinutes: 30,
        serviceCode: "GeneralConsultation",
        bookingKind: "Reserved",
        assignedVeterinarianId: veterinarianId,
        visitReason,
        receptionNote: null,
        settlement: noPayment,
        version: 3,
        checkedInAt: checkedInContext.occurredAt,
        examinationStartedAt: examinationContext.occurredAt,
      },
      eventName: "appointment.examination-started",
      eventPayload: { appointmentId, veterinarianId },
      occurredAt: examinationContext.occurredAt,
      actorUserId,
    });
  });

  test("completes an examination into an awaiting-payment event", () => {
    expect(awaitingPayment).toEqual({
      kind: "AppointmentExaminationCompleted",
      eventId: completionContext.eventId,
      aggregateId: appointmentId,
      aggregateName: "Appointment",
      aggregateState: {
        kind: "AwaitingPayment",
        appointmentId,
        petId,
        ownerId,
        scheduledAt,
        durationMinutes: 30,
        serviceCode: "GeneralConsultation",
        bookingKind: "Reserved",
        assignedVeterinarianId: veterinarianId,
        visitReason,
        receptionNote: null,
        settlement: noPayment,
        version: 4,
        checkedInAt: checkedInContext.occurredAt,
        examinationStartedAt: examinationContext.occurredAt,
        examId,
        examinationCompletedAt: completionContext.occurredAt,
      },
      eventName: "appointment.examination-completed",
      eventPayload: { appointmentId, examId },
      occurredAt: completionContext.occurredAt,
      actorUserId,
    });
  });

  test("records a final settlement event with the resulting state", () => {
    expect(paid).toEqual({
      kind: "AppointmentFinalSettlementRecorded",
      eventId: paymentContext.eventId,
      aggregateId: appointmentId,
      aggregateName: "Appointment",
      aggregateState: {
        kind: "Paid",
        appointmentId,
        petId,
        ownerId,
        scheduledAt,
        durationMinutes: 30,
        serviceCode: "GeneralConsultation",
        bookingKind: "Reserved",
        assignedVeterinarianId: veterinarianId,
        visitReason,
        receptionNote: null,
        settlement: {
          kind: "Settled",
          finalAmount: paymentAmount,
          depositAmount: 0,
          additionalPaymentAmount: 4800,
          refundAmount: 0,
          settledAt: paymentContext.occurredAt,
        },
        version: 5,
        checkedInAt: checkedInContext.occurredAt,
        examinationStartedAt: examinationContext.occurredAt,
        examId,
        examinationCompletedAt: completionContext.occurredAt,
        diagnosis,
        treatment,
      },
      eventName: "appointment.final-settlement-recorded",
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
        durationMinutes: 30,
        serviceCode: "GeneralConsultation",
        bookingKind: "Reserved",
        assignedVeterinarianId: null,
        visitReason,
        receptionNote: null,
        settlement: noPayment,
        version: 2,
        cancellationReason,
        canceledAt: canceledContext.occurredAt,
      },
      eventName: "appointment.canceled",
      eventPayload: { appointmentId, refundAmount: 0 },
      occurredAt: canceledContext.occurredAt,
      actorUserId,
    });
  });
});
