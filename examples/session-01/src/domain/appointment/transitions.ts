import type {
  Appointment,
  CancellationReason,
  RecordPaymentInput,
} from "./appointment.js";

const requireKind = (appointment: Appointment, allowedKinds: ReadonlyArray<Appointment["kind"]>): void => {
  if (!allowedKinds.includes(appointment.kind)) {
    throw new Error(`Cannot transition from ${appointment.kind}`);
  }
};

export const checkIn = (appointment: Appointment, checkedInAt: string): Appointment => {
  requireKind(appointment, ["Scheduled"]);
  return ({ ...appointment, kind: "CheckedIn", checkedInAt }) as Appointment;
};

export const startExamination = (
  appointment: Appointment,
  veterinarianId: string,
  examinationStartedAt: string,
): Appointment => {
  requireKind(appointment, ["CheckedIn"]);
  return ({ ...appointment, kind: "InExamination", veterinarianId, examinationStartedAt }) as Appointment;
};

export const recordPayment = (
  appointment: Appointment,
  input: RecordPaymentInput,
  paidAt: string,
): Appointment => {
  requireKind(appointment, ["InExamination"]);
  return ({ ...appointment, ...input, kind: "Paid", paidAt }) as Appointment;
};

export const cancel = (
  appointment: Appointment,
  reason: CancellationReason | undefined,
  canceledAt: string,
): Appointment => {
  requireKind(appointment, ["Scheduled", "CheckedIn"]);
  if (reason === undefined) throw new Error("Cancellation reason is required");
  return ({ ...appointment, kind: "Canceled", reason, canceledAt }) as Appointment;
};
