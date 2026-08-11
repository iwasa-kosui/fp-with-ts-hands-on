import type { AppointmentId } from "./appointmentId.js";
import type { AppointmentExaminationStarted } from "./appointmentExaminationStarted.js";
import type { EventContext } from "./domainEvent.js";
import type { ExamId } from "./examId.js";
import type { OwnerId } from "./ownerId.js";
import type { PaymentAmount } from "./paymentAmount.js";
import type { PetId } from "./petId.js";
import type { Timestamp } from "./timestamp.js";
import type { VeterinarianId } from "./veterinarianId.js";

export type Scheduled = Readonly<{
  kind: "Scheduled";
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: Timestamp;
}>;
export type CheckedIn = Omit<Scheduled, "kind"> & Readonly<{ kind: "CheckedIn"; checkedInAt: Timestamp }>;
export type InExamination = Omit<CheckedIn, "kind"> & Readonly<{
  kind: "InExamination";
  veterinarianId: VeterinarianId;
  examinationStartedAt: Timestamp;
}>;
export type AwaitingPayment = Readonly<{
  kind: "AwaitingPayment";
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  checkedInAt: Timestamp;
  veterinarianId: VeterinarianId;
  examinationStartedAt: Timestamp;
  examId: ExamId;
  examinationCompletedAt: Timestamp;
}>;
export type Paid = Omit<AwaitingPayment, "kind"> & Readonly<{ kind: "Paid"; amount: PaymentAmount; paidAt: Timestamp }>;
export type Canceled = Omit<Scheduled, "kind"> & Readonly<{
  kind: "Canceled";
  reason: string;
  canceledAt: Timestamp;
}>;
export type Appointment = Scheduled | CheckedIn | InExamination | AwaitingPayment | Paid | Canceled;
export type BookAppointmentInput = Omit<Scheduled, "kind">;
export type CancelInput = Readonly<{ reason: string; now: Timestamp }>;

export const Appointment = {
  book: (input: BookAppointmentInput): Scheduled => ({ kind: "Scheduled", ...input }),
  checkIn: (appointment: Scheduled, now: Timestamp): CheckedIn => ({ ...appointment, kind: "CheckedIn", checkedInAt: now }),
  startExamination: (context: EventContext) => (checkedIn: CheckedIn, veterinarianId: VeterinarianId): AppointmentExaminationStarted => {
    const aggregateState = {
      ...checkedIn,
      kind: "InExamination",
      veterinarianId,
      examinationStartedAt: context.occurredAt,
    } as const satisfies InExamination;

    return {
      kind: "AppointmentExaminationStarted",
      aggregateId: aggregateState.appointmentId,
      aggregateName: "Appointment",
      aggregateState,
      eventName: "appointment.examination-started",
      eventPayload: { appointmentId: aggregateState.appointmentId, veterinarianId },
      occurredAt: context.occurredAt,
    };
  },
  completeExamination: (appointment: InExamination, input: Readonly<{ examId: ExamId; now: Timestamp }>): AwaitingPayment => ({ kind: "AwaitingPayment", appointmentId: appointment.appointmentId, petId: appointment.petId, ownerId: appointment.ownerId, checkedInAt: appointment.checkedInAt, veterinarianId: appointment.veterinarianId, examinationStartedAt: appointment.examinationStartedAt, examId: input.examId, examinationCompletedAt: input.now }),
  recordPayment: (appointment: AwaitingPayment, input: Readonly<{ amount: PaymentAmount }>, paidAt: Timestamp): Paid => ({ ...appointment, ...input, kind: "Paid", paidAt }),
  cancel: (appointment: Scheduled | CheckedIn, input: CancelInput): Canceled => ({ appointmentId: appointment.appointmentId, petId: appointment.petId, ownerId: appointment.ownerId, scheduledAt: appointment.scheduledAt, kind: "Canceled", reason: input.reason, canceledAt: input.now }),
  isTerminal: (appointment: Appointment): appointment is Paid | Canceled => appointment.kind === "Paid" || appointment.kind === "Canceled",
} as const;
