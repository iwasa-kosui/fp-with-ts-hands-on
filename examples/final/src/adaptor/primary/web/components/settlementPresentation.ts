import type { SettlementState } from "../../../../domain/appointment/settlementState.js";

export const settlementPresentation = (status: SettlementState["kind"]): string => {
  switch (status) {
    case "NoPayment": return "未精算";
    case "DepositReceived": return "前受金受領済み";
    case "Settled": return "精算済み";
    case "DepositRefunded": return "前受金返金済み";
    default: return status satisfies never;
  }
};
