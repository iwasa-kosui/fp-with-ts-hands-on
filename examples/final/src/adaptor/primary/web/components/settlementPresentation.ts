import type { SettlementState } from "../../../../domain/appointment/settlementState.js";
import { assertNever } from "../middleware/useCaseResponse.js";

export const settlementPresentation = (status: SettlementState["kind"]): string => {
  switch (status) {
    case "NoPayment":
      return "未精算";
    case "DepositReceived":
      return "前受金受領済み";
    case "Settled":
      return "精算済み";
    case "DepositRefunded":
      return "前受金返金済み";
    default:
      return assertNever(status);
  }
};

export const settlementDetailPresentation = (settlement: SettlementState): string => {
  switch (settlement.kind) {
    case "NoPayment":
      return "未精算";
    case "DepositReceived":
      return `前受金 ${settlement.depositAmount} 円受領済み`;
    case "Settled":
      if (settlement.refundAmount > 0) {
        return `${settlement.refundAmount} 円返金して精算済み`;
      }
      if (settlement.additionalPaymentAmount > 0) {
        return `${settlement.additionalPaymentAmount} 円受領して精算済み`;
      }
      return "差額なしで精算済み";
    case "DepositRefunded":
      return `前受金 ${settlement.depositAmount} 円返金済み`;
    default:
      return assertNever(settlement);
  }
};
