import type { Appointment } from "./appointment.js";

export const toStatusLabel = (appointment: Readonly<{ kind: string }>): string => {
  switch (appointment.kind) {
    case "Scheduled":
      return "予約済み";
    case "CheckedIn":
      return "来院済み";
    case "InExamination":
      return "診察中";
    case "AwaitingPayment":
      return "会計待ち";
    case "Paid":
      return "会計済み";
    case "Canceled":
      return "キャンセル";
    default:
      return "不明";
  }
};

export type StatusLabelAppointment = Appointment;
