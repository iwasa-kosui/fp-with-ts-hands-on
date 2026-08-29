import type { Appointment as AppointmentState } from "./appointment.js";
import { Appointment as appointmentTransitions } from "./transitions.js";

export type {
  AwaitingPayment,
  Canceled,
  CancellationReason,
  CheckedIn,
  CompleteExaminationInput,
  InExamination,
  Paid,
  RecordPaymentInput,
  Scheduled,
} from "./appointment.js";
export type Appointment = AppointmentState;
export * from "./appointmentId.js";
export type { ExaminationStarted } from "./examinationStarted.js";
export * from "./statusLabel.js";
export {
  cancel,
  checkIn,
  completeExamination,
  recordPayment,
  startExamination,
} from "./transitions.js";
export const Appointment = appointmentTransitions;
export * from "./veterinarianId.js";
