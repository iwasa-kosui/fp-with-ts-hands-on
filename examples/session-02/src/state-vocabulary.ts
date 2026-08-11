export const appointmentStates = [
  "Scheduled",
  "CheckedIn",
  "InExamination",
] as const;

export type AppointmentState = (typeof appointmentStates)[number];

export const isTerminalState = (state: string): boolean => state === "Paid";
