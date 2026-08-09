import type { AppointmentPageView } from "../routes/appointmentRoutes.js";
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
      return kind satisfies never;
  }
};

export const serviceLabel = (
  serviceCode: AppointmentPageView["serviceCode"],
): string => {
  switch (serviceCode) {
    case "GeneralConsultation": return "一般診療";
    case "FollowUpVisit": return "再診";
    case "Vaccination": return "予防接種";
    case "ExaminationOrProcedure": return "検査・処置";
    default: return serviceCode satisfies never;
  }
};

export const bookingKindLabel = (
  bookingKind: AppointmentPageView["bookingKind"],
): string => bookingKind === "Reserved" ? "予約" : "飛び込み";

export const settlementLabel = (
  settlement: AppointmentPageView["settlement"],
): string => {
  switch (settlement.kind) {
    case "NoPayment": return "未精算";
    case "DepositReceived": return `前受金 ${settlement.depositAmount} 円受領済み`;
    case "Settled":
      if (settlement.refundAmount > 0) return `${settlement.refundAmount} 円返金して精算済み`;
      if (settlement.additionalPaymentAmount > 0) return `${settlement.additionalPaymentAmount} 円受領して精算済み`;
      return "差額なしで精算済み";
    case "DepositRefunded": return `前受金 ${settlement.depositAmount} 円返金済み`;
    default: return settlement satisfies never;
  }
};
