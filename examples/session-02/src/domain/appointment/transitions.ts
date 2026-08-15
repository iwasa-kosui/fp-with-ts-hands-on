import type {
  CancellationReason,
  CheckedIn,
  InExamination,
  Paid,
  RecordPaymentInput,
  Scheduled,
  Canceled,
} from "./appointment.js";

export const checkIn = (appointment: Scheduled, checkedInAt: string): CheckedIn =>
  ({ ...appointment, kind: "CheckedIn", checkedInAt }) as const satisfies CheckedIn;

export const startExamination = (
  appointment: CheckedIn,
  veterinarianId: string,
  examinationStartedAt: string,
): InExamination =>
  ({
    ...appointment,
    kind: "InExamination",
    veterinarianId,
    examinationStartedAt,
  }) as const satisfies InExamination;

export const recordPayment = (
  appointment: InExamination,
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
