export type Scheduled = Readonly<{
  kind: "Scheduled";
  appointmentId: string;
  petId: string;
  ownerId: string;
  scheduledAt: string;
}>;

export type CheckedIn = Readonly<{
  kind: "CheckedIn";
  appointmentId: string;
  petId: string;
  ownerId: string;
  scheduledAt: string;
  checkedInAt: string;
}>;

export type InExamination = Readonly<{
  kind: "InExamination";
  appointmentId: string;
  petId: string;
  ownerId: string;
  scheduledAt: string;
  checkedInAt: string;
  veterinarianId: string;
  examinationStartedAt: string;
}>;

export type Appointment = Scheduled | CheckedIn | InExamination;

export type BookAppointmentInput = Omit<Scheduled, "kind">;

export const Appointment = {
  book: (input: BookAppointmentInput): Scheduled => ({ kind: "Scheduled", ...input }),
  checkIn: (appointment: Scheduled, now: string): CheckedIn => ({
    ...appointment,
    kind: "CheckedIn",
    checkedInAt: now,
  }),
} as const;
