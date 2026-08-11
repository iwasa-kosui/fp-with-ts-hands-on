export type Scheduled = Readonly<{ kind: "Scheduled"; appointmentId: string; petId: string; ownerId: string; scheduledAt: string }>;
export type CheckedIn = Omit<Scheduled, "kind"> & Readonly<{ kind: "CheckedIn"; checkedInAt: string }>;
export type InExamination = Omit<CheckedIn, "kind"> & Readonly<{ kind: "InExamination"; veterinarianId: string; examinationStartedAt: string }>;
export type AwaitingPayment = Readonly<{
  kind: "AwaitingPayment";
  appointmentId: string;
  petId: string;
  ownerId: string;
  checkedInAt: string;
  veterinarianId: string;
  examinationStartedAt: string;
  examId: string;
  examinationCompletedAt: string;
}>;
export type Paid = Omit<AwaitingPayment, "kind"> & Readonly<{ kind: "Paid"; amount: number; paidAt: string }>;
export type Appointment = Scheduled | CheckedIn | InExamination | AwaitingPayment | Paid;
export type BookAppointmentInput = Omit<Scheduled, "kind">;

export const Appointment = {
  book: (input: BookAppointmentInput): Scheduled => ({ kind: "Scheduled", ...input }),
  checkIn: (appointment: Scheduled, now: string): CheckedIn => ({ ...appointment, kind: "CheckedIn", checkedInAt: now }),
  startExamination: (appointment: CheckedIn, veterinarianId: string, now: string): InExamination => ({ ...appointment, kind: "InExamination", veterinarianId, examinationStartedAt: now }),
  completeExamination: (appointment: InExamination, input: Readonly<{ examId: string; now: string }>): AwaitingPayment => ({
    kind: "AwaitingPayment", appointmentId: appointment.appointmentId, petId: appointment.petId, ownerId: appointment.ownerId,
    checkedInAt: appointment.checkedInAt, veterinarianId: appointment.veterinarianId,
    examinationStartedAt: appointment.examinationStartedAt, examId: input.examId, examinationCompletedAt: input.now,
  }),
  recordPayment: (appointment: AwaitingPayment, input: Readonly<{ amount: number }>, paidAt: string): Paid => ({ ...appointment, ...input, kind: "Paid", paidAt }),
} as const;
