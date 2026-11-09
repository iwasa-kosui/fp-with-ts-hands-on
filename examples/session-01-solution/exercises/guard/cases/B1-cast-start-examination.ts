import {
  recordPayment,
  startExamination,
  type Appointment,
  type CheckedIn,
  type InExamination,
  type Paid,
  type RecordPaymentInput,
} from "../../../src/domain/appointment/index.js";

export const startExaminationFor = (
  current: Appointment,
  veterinarianId: string,
  examinationStartedAt: string,
): InExamination =>
  startExamination(current as CheckedIn, veterinarianId, examinationStartedAt);

export const recordPaymentFor = (
  current: Appointment,
  input: RecordPaymentInput,
  paidAt: string,
): Paid => {
  if (current.kind !== "AwaitingPayment") throw new Error("Invalid appointment state");
  return recordPayment(current, input, paidAt);
};
