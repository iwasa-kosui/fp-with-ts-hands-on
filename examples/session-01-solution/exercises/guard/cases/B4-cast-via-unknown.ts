import {
  recordPayment,
  startExamination,
  type Appointment,
  type AwaitingPayment,
  type InExamination,
  type Paid,
  type RecordPaymentInput,
} from "../../../src/domain/appointment/index.js";

export const startExaminationFor = (
  current: Appointment,
  veterinarianId: string,
  examinationStartedAt: string,
): InExamination => {
  if (current.kind !== "CheckedIn") throw new Error("Invalid appointment state");
  return startExamination(current, veterinarianId, examinationStartedAt);
};

export const recordPaymentFor = (
  current: Appointment,
  input: RecordPaymentInput,
  paidAt: string,
): Paid => recordPayment(current as unknown as AwaitingPayment, input, paidAt);
