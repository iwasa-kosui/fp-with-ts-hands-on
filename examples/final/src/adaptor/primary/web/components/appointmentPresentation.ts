import type { AppointmentPageView } from "../routes/appointmentRoutes.js";
import type { BookingKind } from "../../../../domain/appointment/bookingKind.js";
import { assertNever } from "../middleware/useCaseResponse.js";
import type { StatusTone } from "./StatusBadge.js";

export type AppointmentPresentation = Readonly<{
  label: string;
  tone: StatusTone;
}>;

export const appointmentPresentation = (
  kind: AppointmentPageView["kind"],
): AppointmentPresentation => {
  switch (kind) {
    case "Scheduled":
      return { label: "予約済み", tone: "neutral" };
    case "CheckedIn":
      return { label: "受付済み", tone: "info" };
    case "InExamination":
      return { label: "診察中", tone: "warning" };
    case "AwaitingPayment":
      return { label: "会計待ち", tone: "warning" };
    case "Paid":
      return { label: "会計済み", tone: "success" };
    case "Canceled":
      return { label: "キャンセル", tone: "danger" };
    default:
      return assertNever(kind);
  }
};

export const bookingKindPresentation = (bookingKind: BookingKind): string => {
  switch (bookingKind) {
    case "Reserved":
      return "予約";
    case "WalkIn":
      return "飛び込み";
    default:
      return assertNever(bookingKind);
  }
};
