import type { DomainEvent } from "../aggregate/domainEvent.js";
import type { EventContext } from "../aggregate/eventContext.js";
import type { Appointment, AwaitingPayment, Canceled, CheckedIn, InExamination, Paid, Scheduled } from "./appointment.js";
import type { AppointmentId } from "./appointmentId.js";
import type { VeterinarianId } from "./veterinarianId.js";
import type { ExamId } from "../examResult/examId.js";
import type { PaymentAmount } from "./paymentAmount.js";
import type { SettlementAdjustmentAmount } from "./settlementAdjustmentAmount.js";

type AppointmentDomainEvent<
  TAggregateState extends Appointment,
  TKind extends string,
  TEventName extends string,
  TEventPayload extends Readonly<Record<string, unknown>>,
> = Readonly<
  Omit<
    DomainEvent<
      AppointmentId,
      "Appointment",
      TAggregateState,
      TKind,
      TEventName,
      TEventPayload
    >,
    "aggregateState"
  > & {
    aggregateState: TAggregateState;
  }
>;

export type AppointmentBooked = AppointmentDomainEvent<
  Scheduled,
  "AppointmentBooked",
  "appointment.booked",
  Readonly<{ appointmentId: AppointmentId }>
>;

export type AppointmentCheckedIn = AppointmentDomainEvent<
  CheckedIn,
  "AppointmentCheckedIn",
  "appointment.checked-in",
  Readonly<{ appointmentId: AppointmentId }>
>;

export type ExaminationStarted = AppointmentDomainEvent<
  InExamination,
  "ExaminationStarted",
  "appointment.examination-started",
  Readonly<{ appointmentId: AppointmentId; veterinarianId: VeterinarianId }>
>;

export type AppointmentExaminationCompleted = AppointmentDomainEvent<
  AwaitingPayment,
  "AppointmentExaminationCompleted",
  "appointment.examination-completed",
  Readonly<{ appointmentId: AppointmentId; examId: ExamId }>
>;

export type AppointmentReceptionNoteUpdated = AppointmentDomainEvent<
  Scheduled | CheckedIn | InExamination | AwaitingPayment,
  "AppointmentReceptionNoteUpdated",
  "appointment.reception-note-updated",
  Readonly<{ appointmentId: AppointmentId }>
>;

export type AppointmentDepositReceived = AppointmentDomainEvent<
  Scheduled | CheckedIn,
  "AppointmentDepositReceived",
  "appointment.deposit-received",
  Readonly<{ appointmentId: AppointmentId; depositAmount: PaymentAmount }>
>;

export type AppointmentFinalSettlementRecorded = AppointmentDomainEvent<
  Paid,
  "AppointmentFinalSettlementRecorded",
  "appointment.final-settlement-recorded",
  Readonly<{ appointmentId: AppointmentId }>
>;

export type PaymentRecorded = AppointmentFinalSettlementRecorded;

export type AppointmentCanceled = AppointmentDomainEvent<
  Canceled,
  "AppointmentCanceled",
  "appointment.canceled",
  Readonly<{
    appointmentId: AppointmentId;
    refundAmount: SettlementAdjustmentAmount;
  }>
>;

export type AppointmentUpdated = AppointmentDomainEvent<
  Scheduled,
  "AppointmentUpdated",
  "appointment.updated",
  Readonly<{ appointmentId: AppointmentId }>
>;

export type AppointmentWalkInRegistered = AppointmentDomainEvent<
  CheckedIn,
  "AppointmentWalkInRegistered",
  "appointment.walk-in-registered",
  Readonly<{ appointmentId: AppointmentId }>
>;

export type AppointmentVeterinarianReassigned = AppointmentDomainEvent<
  Scheduled | CheckedIn,
  "AppointmentVeterinarianReassigned",
  "appointment.veterinarian-reassigned",
  Readonly<{ appointmentId: AppointmentId; veterinarianId: VeterinarianId | null }>
>;

export type AppointmentEvent =
  | AppointmentBooked
  | AppointmentCheckedIn
  | ExaminationStarted
  | AppointmentExaminationCompleted
  | AppointmentReceptionNoteUpdated
  | AppointmentDepositReceived
  | AppointmentFinalSettlementRecorded
  | AppointmentCanceled
  | AppointmentUpdated
  | AppointmentWalkInRegistered
  | AppointmentVeterinarianReassigned;

const create = <
  TAggregateState extends Appointment,
  TKind extends string,
  TEventName extends string,
  TEventPayload extends Readonly<Record<string, unknown>>,
>(
  context: EventContext,
  aggregateId: AppointmentId,
  aggregateState: TAggregateState,
  kind: TKind,
  eventName: TEventName,
  eventPayload: TEventPayload,
): AppointmentDomainEvent<
  TAggregateState,
  TKind,
  TEventName,
  TEventPayload
> => ({
  kind,
  eventId: context.eventId,
  aggregateId,
  aggregateName: "Appointment",
  aggregateState,
  eventName,
  eventPayload,
  occurredAt: context.occurredAt,
  actorUserId: context.actorUserId,
});

export const AppointmentEvent = { create } as const;
