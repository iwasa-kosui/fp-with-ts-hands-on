import type { Appointment } from "./appointment.js";

const statusLabels: Record<string, string> = {
  scheduled: "予約済み",
  "checked-in": "来院済み",
  "in-examination": "診察中",
  "awaiting-payment": "会計待ち",
  paid: "会計済み",
  canceled: "キャンセル",
};

export const toStatusLabel = (appointment: Appointment): string => {
  const label = Object.hasOwn(statusLabels, appointment.status)
    ? statusLabels[appointment.status]
    : undefined;

  return label ?? appointment.status;
};
