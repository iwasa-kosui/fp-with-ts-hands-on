import type { Appointment } from "../../../src/domain/appointment/index.js";

export const toStatusLabel = (appointment: Appointment): string => {
  if (appointment.kind === "Scheduled") {
    return "予約済み";
  }
  if (appointment.kind === "CheckedIn") {
    return "来院済み";
  }
  if (appointment.kind === "InExamination") {
    return "診察中";
  }
  if (appointment.kind === "AwaitingPayment") {
    return "会計待ち";
  }
  if (appointment.kind === "Canceled") {
    return "キャンセル";
  }
  return "不明";
};
