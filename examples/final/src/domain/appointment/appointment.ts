import type { Timestamp } from "../aggregate/timestamp.js";
import type { OwnerId } from "../owner/ownerId.js";
import type { PetId } from "../pet/petId.js";
import type { EventContext } from "../aggregate/eventContext.js";
import {
  AppointmentEvent,
  type AppointmentBooked,
  type AppointmentCanceled,
  type AppointmentCheckedIn,
  type ExaminationStarted,
  type PaymentRecorded,
} from "./appointmentEvent.js";
import type { AppointmentId } from "./appointmentId.js";
import type { PaymentAmount } from "./paymentAmount.js";
import type { VeterinarianId } from "./veterinarianId.js";
import type { Sensitive } from "../shared/sensitive.js";

export type Scheduled = Readonly<{
  kind: "Scheduled";
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: Timestamp;
  reason: Sensitive<string>;
}>;

export type CheckedIn = Readonly<{
  kind: "CheckedIn";
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: Timestamp;
  reason: Sensitive<string>;
  checkedInAt: Timestamp;
}>;

export type InExamination = Readonly<{
  kind: "InExamination";
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: Timestamp;
  reason: Sensitive<string>;
  checkedInAt: Timestamp;
  veterinarianId: VeterinarianId;
  examinationStartedAt: Timestamp;
}>;

export type Paid = Readonly<{
  kind: "Paid";
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: Timestamp;
  reason: Sensitive<string>;
  checkedInAt: Timestamp;
  veterinarianId: VeterinarianId;
  examinationStartedAt: Timestamp;
  diagnosis: Sensitive<string>;
  treatment: Sensitive<string>;
  amount: PaymentAmount;
  paidAt: Timestamp;
}>;

export type Canceled = Readonly<{
  kind: "Canceled";
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: Timestamp;
  reason: Sensitive<string>;
  canceledAt: Timestamp;
}>;

export type Appointment =
  Scheduled | CheckedIn | InExamination | Paid | Canceled;
export type BookAppointmentInput = Readonly<Omit<Scheduled, "kind">>;
export type RecordPaymentInput = Readonly<
  Pick<Paid, "diagnosis" | "treatment" | "amount">
>;
export type CancelReason = Sensitive<string>;

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
  (examining: InExamination, input: RecordPaymentInput): PaymentRecorded => {
    const aggregateState = {
      ...examining,
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

const cancel =
  (context: EventContext) =>
  (
    appointment: Scheduled | CheckedIn,
    reason: CancelReason,
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
  recordPayment,
  cancel,
  isActive: (appointment: Appointment) =>
    appointment.kind === "Scheduled" ||
    appointment.kind === "CheckedIn" ||
    appointment.kind === "InExamination",
} as const;
