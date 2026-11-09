import type { Appointment } from "../../../src/domain/appointment/index.js";

type NoShow = Readonly<{
  kind: "NoShow";
  appointmentId: string;
  scheduledAt: string;
  reason: string;
  noShowAt: string;
}>;

export const toStatusLabel = (appointment: Appointment | NoShow): string => {
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
