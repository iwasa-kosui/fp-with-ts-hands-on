import type {
  AwaitingPayment,
  CancellationReason,
  CompleteExaminationInput,
  Canceled,
  CheckedIn,
  InExamination,
  Paid,
  RecordPaymentInput,
  Scheduled,
} from "./appointment.js";
import type { VeterinarianId } from "../ids/veterinarianId.js";

export const checkIn = (appointment: Scheduled, checkedInAt: string): CheckedIn =>
  ({ ...appointment, kind: "CheckedIn", checkedInAt }) as const satisfies CheckedIn;

export const startExamination = (
  appointment: CheckedIn,
  veterinarianId: VeterinarianId,
  examinationStartedAt: string,
): InExamination =>
  ({
    ...appointment,
    kind: "InExamination",
    veterinarianId,
    examinationStartedAt,
  }) as const satisfies InExamination;

export const completeExamination = (
  appointment: InExamination,
  input: CompleteExaminationInput,
  examinationCompletedAt: string,
): AwaitingPayment =>
  ({
    ...appointment,
    ...input,
    kind: "AwaitingPayment",
    examinationCompletedAt,
  }) as const satisfies AwaitingPayment;

export const recordPayment = (
  appointment: AwaitingPayment,
  input: RecordPaymentInput,
  paidAt: string,
): Paid =>
  ({ ...appointment, ...input, kind: "Paid", paidAt }) as const satisfies Paid;

export const cancel = (
  appointment: Scheduled | CheckedIn,
  reason: CancellationReason,
  canceledAt: string,
): Canceled =>
  ({
    kind: "Canceled",
    appointmentId: appointment.appointmentId,
    petId: appointment.petId,
    ownerId: appointment.ownerId,
    scheduledAt: appointment.scheduledAt,
    reason,
    canceledAt,
  }) as const satisfies Canceled;
