import type { AppointmentId } from "../ids/appointmentId.js";
import type { OwnerId } from "../ids/ownerId.js";
import type { PetId } from "../ids/petId.js";
import type { VeterinarianId } from "../ids/veterinarianId.js";

export type CancellationReason = string;

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
  reason: CancellationReason;
  canceledAt: string;
}>;

export type Appointment = Scheduled | CheckedIn | InExamination | Paid | Canceled;

export type RecordPaymentInput = Readonly<{
  diagnosis: string;
  treatment: string;
  amount: number;
}>;
