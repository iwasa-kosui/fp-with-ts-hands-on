export const appointmentStates = [
  "Scheduled",
  "CheckedIn",
  "InExamination",
] as const;

export type AppointmentState = (typeof appointmentStates)[number];
