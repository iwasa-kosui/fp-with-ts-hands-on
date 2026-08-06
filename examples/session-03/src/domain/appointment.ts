import type { AppointmentId } from "./appointment-id.js";
import type { OwnerId } from "./owner-id.js";
import type { PetId } from "./pet-id.js";
import type { VeterinarianId } from "./veterinarian-id.js";

export type Scheduled = Readonly<{
  kind: "Scheduled";
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: string;
  reason: string;
}>;

export type CheckedIn = Readonly<{
  kind: "CheckedIn";
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: string;
  reason: string;
  checkedInAt: string;
}>;

export type InExamination = Readonly<{
  kind: "InExamination";
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: string;
  reason: string;
  checkedInAt: string;
  veterinarianId: VeterinarianId;
  examinationStartedAt: string;
}>;

export type Paid = Readonly<{
  kind: "Paid";
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: string;
  reason: string;
  checkedInAt: string;
  veterinarianId: VeterinarianId;
  examinationStartedAt: string;
  diagnosis: string;
  treatment: string;
  amount: number;
  paidAt: string;
}>;

export type Canceled = Readonly<{
  kind: "Canceled";
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: string;
  reason: string;
  cancellationReason: string;
  canceledAt: string;
  followUpRequestedAt?: string;
}>;

export type Appointment = Scheduled | CheckedIn | InExamination | Paid | Canceled;

export type BookAppointmentInput = Readonly<{
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: string;
  reason: string;
}>;

export type RecordPaymentInput = Readonly<{
  diagnosis: string;
  treatment: string;
  amount: number;
}>;

export const Appointment = {
  book: (input: BookAppointmentInput): Scheduled => ({ kind: "Scheduled", ...input }),
  checkIn: (appointment: Scheduled, now: string): CheckedIn => ({
    ...appointment,
    kind: "CheckedIn",
    checkedInAt: now,
  }),
  startExamination: (
    appointment: CheckedIn,
    veterinarianId: VeterinarianId,
    now: string,
  ): InExamination => ({
    ...appointment,
    kind: "InExamination",
    veterinarianId,
    examinationStartedAt: now,
  }),
  recordPayment: (
    appointment: InExamination,
    input: RecordPaymentInput,
    now: string,
  ): Paid => ({ ...appointment, ...input, kind: "Paid", paidAt: now }),
  cancelWithReason: (
    appointment: Scheduled | CheckedIn,
    cancellationReason: string,
    canceledAt: string,
    followUpRequestedAt?: string,
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
