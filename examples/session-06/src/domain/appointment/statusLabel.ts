import type { Appointment } from "./appointment.js";

const assertNever = (value: never): never => {
  throw new Error(`Unknown appointment status: ${JSON.stringify(value)}`);
};

export const toStatusLabel = (appointment: Appointment): string => {
  switch (appointment.kind) {
    case "Scheduled":
      return "予約済み";
    case "CheckedIn":
      return "来院済み";
    case "InExamination":
      return "診察中";
    case "Paid":
      return "会計済み";
    case "Canceled":
      return "キャンセル";
    default:
      return assertNever(appointment);
  }
};
