import type { Timestamp } from "../aggregate/timestamp.js";
import type { PaymentAmount } from "./paymentAmount.js";
import { SettlementAdjustmentAmount } from "./settlementAdjustmentAmount.js";

export type NoPayment = Readonly<{ kind: "NoPayment" }>;

export type DepositReceived = Readonly<{
  kind: "DepositReceived";
  depositAmount: PaymentAmount;
  receivedAt: Timestamp;
}>;

export type Settled = Readonly<{
  kind: "Settled";
  finalAmount: PaymentAmount;
  depositAmount: SettlementAdjustmentAmount;
  additionalPaymentAmount: SettlementAdjustmentAmount;
  refundAmount: SettlementAdjustmentAmount;
  settledAt: Timestamp;
}>;

export type DepositRefunded = Readonly<{
  kind: "DepositRefunded";
  depositAmount: PaymentAmount;
  refundedAt: Timestamp;
}>;

export type SettlementState = NoPayment | DepositReceived | Settled | DepositRefunded;

const settle = (
  current: NoPayment | DepositReceived,
  finalAmount: PaymentAmount,
  settledAt: Timestamp,
): Settled => {
  const deposit = current.kind === "DepositReceived" ? current.depositAmount : 0;

  return {
    kind: "Settled",
    finalAmount,
    depositAmount: SettlementAdjustmentAmount.schema.parse(deposit),
    additionalPaymentAmount: SettlementAdjustmentAmount.schema.parse(
      Math.max(finalAmount - deposit, 0),
    ),
    refundAmount: SettlementAdjustmentAmount.schema.parse(Math.max(deposit - finalAmount, 0)),
    settledAt,
  };
};

export const Settlement = { settle } as const;
