import type {
  Appointment,
  CancellationReason,
  RecordPaymentInput,
} from "./appointment.js";

export const checkIn = (appointment: Appointment, checkedInAt: string): Appointment =>
  ({ ...appointment, kind: "CheckedIn", checkedInAt }) as Appointment;

export const startExamination = (
  appointment: Appointment,
  veterinarianId: string,
  examinationStartedAt: string,
): Appointment =>
  ({ ...appointment, kind: "InExamination", veterinarianId, examinationStartedAt }) as Appointment;

export const recordPayment = (
  appointment: Appointment,
  input: RecordPaymentInput,
  paidAt: string,
): Appointment => ({ ...appointment, ...input, kind: "Paid", paidAt }) as Appointment;

export const cancel = (
  appointment: Appointment,
  reason: CancellationReason | undefined,
  canceledAt: string,
): Appointment => ({ ...appointment, kind: "Canceled", reason, canceledAt }) as Appointment;
