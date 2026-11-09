import type { Appointment } from "../../../src/domain/appointment/index.js";

export const toStatusLabel = (appointment: Appointment): string => {
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
  }
};
