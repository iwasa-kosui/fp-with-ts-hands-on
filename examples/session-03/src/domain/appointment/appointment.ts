import type { AppointmentId } from "./appointmentId.js";
import type { VeterinarianId } from "./veterinarianId.js";
import type { ExamId } from "../examResult/index.js";
import type { OwnerId } from "../owner/index.js";
import type { PetId } from "../pet/index.js";

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

export type AwaitingPayment = Readonly<{
  kind: "AwaitingPayment";
  appointmentId: AppointmentId;
  petId: PetId;
  ownerId: OwnerId;
  scheduledAt: string;
  reason: string;
  checkedInAt: string;
  veterinarianId: VeterinarianId;
  examinationStartedAt: string;
  examId: ExamId;
  examinationCompletedAt: string;
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
  examId: ExamId;
  examinationCompletedAt: string;
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

export type Appointment =
  | Scheduled
  | CheckedIn
  | InExamination
  | AwaitingPayment
  | Paid
  | Canceled;

export type CompleteExaminationInput = Readonly<{ examId: ExamId }>;

export type RecordPaymentInput = Readonly<{
  diagnosis: string;
  treatment: string;
  amount: number;
}>;
