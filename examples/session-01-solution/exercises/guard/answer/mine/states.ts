import type {
  Appointment,
  AwaitingPayment,
  Canceled,
  CheckedIn,
  InExamination,
  Paid,
  Scheduled,
} from "../../../../src/domain/appointment/index.js";
import { ExamId } from "../../../../src/domain/examResult/index.js";
import { OwnerId } from "../../../../src/domain/owner/index.js";
import { PetId } from "../../../../src/domain/pet/index.js";

export const scheduled: Scheduled = {
  kind: "Scheduled",
  appointmentId: "11111111-1111-4111-8111-111111111111",
  petId: PetId.parse("22222222-2222-4222-8222-222222222222"),
  ownerId: OwnerId.parse("33333333-3333-4333-8333-333333333333"),
  scheduledAt: "2026-08-30T06:00:00.000Z",
  reason: "skin check",
};

export const checkedIn: CheckedIn = {
  ...scheduled,
  kind: "CheckedIn",
  checkedInAt: "2026-08-30T06:10:00.000Z",
};

export const inExamination: InExamination = {
  ...checkedIn,
  kind: "InExamination",
  veterinarianId: "44444444-4444-4444-8444-444444444444",
  examinationStartedAt: "2026-08-30T06:20:00.000Z",
};

export const awaitingPayment: AwaitingPayment = {
  ...inExamination,
  kind: "AwaitingPayment",
  examId: ExamId.parse("77777777-7777-4777-8777-777777777777"),
  examinationCompletedAt: "2026-08-30T06:40:00.000Z",
};

export const paid: Paid = {
  ...awaitingPayment,
  kind: "Paid",
  diagnosis: "dermatitis",
  treatment: "ointment",
  amount: 4800,
  paidAt: "2026-08-30T06:50:00.000Z",
};

export const canceled: Canceled = {
  kind: "Canceled",
  appointmentId: scheduled.appointmentId,
  petId: scheduled.petId,
  ownerId: scheduled.ownerId,
  scheduledAt: scheduled.scheduledAt,
  reason: "owner request",
  canceledAt: "2026-08-30T05:50:00.000Z",
};

export const appointments: readonly Appointment[] = [
  scheduled,
  checkedIn,
  inExamination,
  awaitingPayment,
  paid,
  canceled,
];
