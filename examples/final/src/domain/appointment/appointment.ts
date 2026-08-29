import type { Timestamp } from "../aggregate/timestamp.js";
import type { OwnerId } from "../owner/index.js";
import type { PetId } from "../pet/index.js";
import type { EventContext } from "../aggregate/eventContext.js";
import {
  AppointmentEvent,
  type AppointmentBooked,
  type AppointmentCanceled,
  type AppointmentCheckedIn,
  type AppointmentExaminationCompleted,
  type ExaminationStarted,
  type PaymentRecorded,
} from "./appointmentEvent.js";
import type { ExamId } from "../examResult/index.js";
import type { AppointmentId } from "./appointmentId.js";
import type { PaymentAmount } from "./paymentAmount.js";
import type { VeterinarianId } from "./veterinarianId.js";
import type { AppointmentReason } from "./appointmentReason.js";
import type { CancellationReason } from "./cancellationReason.js";
import type { Diagnosis } from "./diagnosis.js";
import type { Treatment } from "./treatment.js";

export type Scheduled = Readonly<{
  kind: "Scheduled";
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: Timestamp;
  reason: AppointmentReason;
}>;

export type CheckedIn = Readonly<{
  kind: "CheckedIn";
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: Timestamp;
  reason: AppointmentReason;
  checkedInAt: Timestamp;
}>;

export type InExamination = Readonly<{
  kind: "InExamination";
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: Timestamp;
  reason: AppointmentReason;
  checkedInAt: Timestamp;
  veterinarianId: VeterinarianId;
  examinationStartedAt: Timestamp;
}>;

export type AwaitingPayment = Readonly<{
  kind: "AwaitingPayment";
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: Timestamp;
  reason: AppointmentReason;
  checkedInAt: Timestamp;
  veterinarianId: VeterinarianId;
  examinationStartedAt: Timestamp;
  examId: ExamId;
  examinationCompletedAt: Timestamp;
}>;

export type Paid = Readonly<{
  kind: "Paid";
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: Timestamp;
  reason: AppointmentReason;
  checkedInAt: Timestamp;
  veterinarianId: VeterinarianId;
  examinationStartedAt: Timestamp;
  examId: ExamId;
  examinationCompletedAt: Timestamp;
  diagnosis: Diagnosis;
  treatment: Treatment;
  amount: PaymentAmount;
  paidAt: Timestamp;
}>;

export type Canceled = Readonly<{
  kind: "Canceled";
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: Timestamp;
  reason: CancellationReason;
  canceledAt: Timestamp;
}>;

export type Appointment =
  Scheduled | CheckedIn | InExamination | AwaitingPayment | Paid | Canceled;
export type BookAppointmentInput = Readonly<Omit<Scheduled, "kind">>;
export type CompleteExaminationInput = Readonly<{ examId: ExamId }>;
export type RecordPaymentInput = Readonly<
  Pick<Paid, "diagnosis" | "treatment" | "amount">
>;
const book =
  (context: EventContext) =>
  (input: BookAppointmentInput): AppointmentBooked => {
    const aggregateState = {
      kind: "Scheduled",
      ...input,
    } as const satisfies Scheduled;

    return AppointmentEvent.create(
      context,
      aggregateState.appointmentId,
      aggregateState,
      "AppointmentBooked",
      "appointment.booked",
      { appointmentId: aggregateState.appointmentId },
    );
  };

const checkIn =
  (context: EventContext) =>
  (scheduled: Scheduled): AppointmentCheckedIn => {
    const aggregateState = {
      ...scheduled,
      kind: "CheckedIn",
      checkedInAt: context.occurredAt,
    } as const satisfies CheckedIn;

    return AppointmentEvent.create(
      context,
      aggregateState.appointmentId,
      aggregateState,
      "AppointmentCheckedIn",
      "appointment.checked-in",
      { appointmentId: aggregateState.appointmentId },
    );
  };

const startExamination =
  (context: EventContext) =>
  (
    checkedIn: CheckedIn,
    veterinarianId: VeterinarianId,
  ): ExaminationStarted => {
    const aggregateState = {
      ...checkedIn,
      kind: "InExamination",
      veterinarianId,
      examinationStartedAt: context.occurredAt,
    } as const satisfies InExamination;

    return AppointmentEvent.create(
      context,
      aggregateState.appointmentId,
      aggregateState,
      "ExaminationStarted",
      "appointment.examination-started",
      { appointmentId: aggregateState.appointmentId, veterinarianId },
    );
  };

const recordPayment =
  (context: EventContext) =>
  (
    awaitingPayment: AwaitingPayment,
    input: RecordPaymentInput,
  ): PaymentRecorded => {
    const aggregateState = {
      ...awaitingPayment,
      ...input,
      kind: "Paid",
      paidAt: context.occurredAt,
    } as const satisfies Paid;

    return AppointmentEvent.create(
      context,
      aggregateState.appointmentId,
      aggregateState,
      "PaymentRecorded",
      "appointment.payment-recorded",
      { appointmentId: aggregateState.appointmentId },
    );
  };

const completeExamination =
  (context: EventContext) =>
  (
    examining: InExamination,
    input: CompleteExaminationInput,
  ): AppointmentExaminationCompleted => {
    const aggregateState = {
      ...examining,
      kind: "AwaitingPayment",
      examId: input.examId,
      examinationCompletedAt: context.occurredAt,
    } as const satisfies AwaitingPayment;

    return AppointmentEvent.create(
      context,
      aggregateState.appointmentId,
      aggregateState,
      "AppointmentExaminationCompleted",
      "appointment.examination-completed",
      { appointmentId: aggregateState.appointmentId, examId: input.examId },
    );
  };

const cancel =
  (context: EventContext) =>
  (
    appointment: Scheduled | CheckedIn,
    reason: CancellationReason,
  ): AppointmentCanceled => {
    const aggregateState = {
      kind: "Canceled",
      appointmentId: appointment.appointmentId,
      petId: appointment.petId,
      ownerId: appointment.ownerId,
      scheduledAt: appointment.scheduledAt,
      reason,
      canceledAt: context.occurredAt,
    } as const satisfies Canceled;

    return AppointmentEvent.create(
      context,
      aggregateState.appointmentId,
      aggregateState,
      "AppointmentCanceled",
      "appointment.canceled",
      { appointmentId: aggregateState.appointmentId },
    );
  };

export const Appointment = {
  book,
  checkIn,
  startExamination,
  completeExamination,
  recordPayment,
  cancel,
  isActive: (appointment: Appointment) =>
    appointment.kind === "Scheduled" ||
    appointment.kind === "CheckedIn" ||
    appointment.kind === "InExamination" ||
    appointment.kind === "AwaitingPayment",
} as const;
