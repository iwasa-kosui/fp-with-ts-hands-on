export type Scheduled = Readonly<{
  kind: "Scheduled";
  appointmentId: string;
  petId: string;
  ownerId: string;
  scheduledAt: string;
}>;
export type CheckedIn = Omit<Scheduled, "kind"> & Readonly<{ kind: "CheckedIn"; checkedInAt: string }>;
export type InExamination = Omit<CheckedIn, "kind"> & Readonly<{
  kind: "InExamination";
  veterinarianId: string;
  examinationStartedAt: string;
}>;
export type Appointment = Scheduled | CheckedIn | InExamination;
export type BookAppointmentInput = Omit<Scheduled, "kind">;

const assertNever = (value: never): never => {
  throw new Error(`Unhandled appointment state: ${JSON.stringify(value)}`);
};

export const display = (appointment: Appointment): string => {
  switch (appointment.kind) {
    case "Scheduled": return `予約済み: ${appointment.appointmentId}`;
    case "CheckedIn": return `受付済み: ${appointment.appointmentId}`;
    case "InExamination": return `診察中: ${appointment.appointmentId}`;
    default: return assertNever(appointment);
  }
};

export const Appointment = {
  book: (input: BookAppointmentInput): Scheduled => ({ kind: "Scheduled", ...input }),
  checkIn: (appointment: Scheduled, now: string): CheckedIn => ({
    ...appointment, kind: "CheckedIn", checkedInAt: now,
  }),
  startExamination: (appointment: CheckedIn, veterinarianId: string, now: string): InExamination => ({
    ...appointment, kind: "InExamination", veterinarianId, examinationStartedAt: now,
  }),
} as const;
