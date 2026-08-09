import type { AppointmentPageView } from "../routes/appointmentRoutes.js";
import type { StatusTone } from "./StatusBadge.js";

export type AppointmentPresentation = Readonly<{
  canonical: string;
  label: string;
  tone: StatusTone;
}>;

export const appointmentPresentation = (
  kind: AppointmentPageView["kind"],
): AppointmentPresentation => {
  switch (kind) {
    case "Scheduled":
      return { canonical: kind, label: "予約済み", tone: "neutral" };
    case "CheckedIn":
      return { canonical: kind, label: "受付済み", tone: "info" };
    case "InExamination":
      return { canonical: kind, label: "診察中", tone: "warning" };
    case "AwaitingPayment":
      return { canonical: kind, label: "会計待ち", tone: "warning" };
    case "Paid":
      return { canonical: kind, label: "会計済み", tone: "success" };
    case "Canceled":
      return { canonical: kind, label: "キャンセル", tone: "danger" };
    default:
      return kind satisfies never;
  }
};
