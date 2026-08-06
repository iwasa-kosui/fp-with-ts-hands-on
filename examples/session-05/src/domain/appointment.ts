import type { AppointmentId } from "./appointment-id.js";
import type { OwnerId } from "./owner-id.js";
import type { PetId } from "./pet-id.js";
import type { Timestamp } from "./timestamp.js";
import type { VeterinarianId } from "./veterinarian-id.js";

export type Scheduled = Readonly<{
  kind: "Scheduled";
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: Timestamp;
  reason: string;
}>;

export type CheckedIn = Readonly<{
  kind: "CheckedIn";
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: Timestamp;
  reason: string;
  checkedInAt: Timestamp;
}>;

export type InExamination = Readonly<{
  kind: "InExamination";
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: Timestamp;
  reason: string;
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
  reason: string;
  checkedInAt: Timestamp;
  veterinarianId: VeterinarianId;
  examinationStartedAt: Timestamp;
  diagnosis: string;
  treatment: string;
  amount: number;
  paidAt: Timestamp;
}>;

export type Canceled = Readonly<{
  kind: "Canceled";
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: Timestamp;
  reason: string;
  cancellationReason: string;
  canceledAt: Timestamp;
  followUpRequestedAt?: Timestamp;
}>;

export type Appointment = Scheduled | CheckedIn | InExamination | Paid | Canceled;

export type BookAppointmentInput = Readonly<{
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: Timestamp;
  reason: string;
}>;

export type RecordPaymentInput = Readonly<{
  diagnosis: string;
  treatment: string;
  amount: number;
}>;

export const Appointment = {
  book: (input: BookAppointmentInput): Scheduled => ({ kind: "Scheduled", ...input }),
  checkIn: (appointment: Scheduled, now: Timestamp): CheckedIn => ({
    ...appointment,
    kind: "CheckedIn",
    checkedInAt: now,
  }),
  startExamination: (
    appointment: CheckedIn,
    veterinarianId: VeterinarianId,
    now: Timestamp,
  ): InExamination => ({
    ...appointment,
    kind: "InExamination",
    veterinarianId,
    examinationStartedAt: now,
  }),
  recordPayment: (
    appointment: InExamination,
    input: RecordPaymentInput,
    now: Timestamp,
  ): Paid => ({ ...appointment, ...input, kind: "Paid", paidAt: now }),
  cancelWithReason: (
    appointment: Scheduled | CheckedIn,
    cancellationReason: string,
    canceledAt: Timestamp,
    followUpRequestedAt?: Timestamp,
  ): Canceled => ({
    kind: "Canceled",
    appointmentId: appointment.appointmentId,
    petId: appointment.petId,
    ownerId: appointment.ownerId,
    scheduledAt: appointment.scheduledAt,
    reason: appointment.reason,
    cancellationReason,
    canceledAt,
    ...(followUpRequestedAt === undefined ? {} : { followUpRequestedAt }),
  }),
  isTerminal: (appointment: Appointment): appointment is Paid | Canceled =>
    appointment.kind === "Paid" || appointment.kind === "Canceled",
} as const;
