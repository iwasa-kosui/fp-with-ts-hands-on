export type Scheduled = Readonly<{
  kind: "Scheduled";
  appointmentId: string;
  petId: string;
  ownerId: string;
  scheduledAt: string;
}>;

export type CheckedIn = Omit<Scheduled, "kind"> &
  Readonly<{
    kind: "CheckedIn";
    checkedInAt: string;
  }>;

export type InExamination = Omit<CheckedIn, "kind"> &
  Readonly<{
    kind: "InExamination";
    veterinarianId: string;
    examinationStartedAt: string;
  }>;

export type Appointment = Scheduled | CheckedIn | InExamination;

export type BookAppointmentInput = Omit<Scheduled, "kind">;

export const Appointment = {
  book: (input: BookAppointmentInput): Scheduled => ({ kind: "Scheduled", ...input }),
  checkIn: (_appointment: Scheduled, _now: string): CheckedIn => {
    throw new Error("Appointment.checkIn must record a CheckedIn transition.");
  },
} as const;
