import { z } from "zod";

import { Timestamp, type Timestamp as TimestampValue } from "../aggregate/timestamp.js";
import { PaymentAmount, type PaymentAmount as PaymentAmountValue } from "./paymentAmount.js";
import type { ServiceCode } from "./serviceCode.js";
import { SettlementAdjustmentAmount } from "./settlementAdjustmentAmount.js";

export type NoPayment = Readonly<{ kind: "NoPayment" }>;

export const NoPayment = {
  schema: z.object({ kind: z.literal("NoPayment") }),
} as const;

export type DepositReceived = Readonly<{
  kind: "DepositReceived";
  depositAmount: PaymentAmountValue;
  receivedAt: TimestampValue;
}>;

export const DepositReceived = {
  schema: z.object({
    kind: z.literal("DepositReceived"),
    depositAmount: PaymentAmount.schema,
    receivedAt: Timestamp.schema,
  }),
} as const;

export type Settled = Readonly<{
  kind: "Settled";
  finalAmount: PaymentAmountValue;
  depositAmount: SettlementAdjustmentAmount;
  additionalPaymentAmount: SettlementAdjustmentAmount;
  refundAmount: SettlementAdjustmentAmount;
  settledAt: TimestampValue;
}>;

const SettledSchema = z.object({
  kind: z.literal("Settled"),
  finalAmount: PaymentAmount.schema,
  depositAmount: SettlementAdjustmentAmount.schema,
  additionalPaymentAmount: SettlementAdjustmentAmount.schema,
  refundAmount: SettlementAdjustmentAmount.schema,
  settledAt: Timestamp.schema,
}).superRefine((settled, context) => {
  const expectedAdditionalPayment = Math.max(
    settled.finalAmount - settled.depositAmount,
    0,
  );
  const expectedRefund = Math.max(
    settled.depositAmount - settled.finalAmount,
    0,
  );
  if (
    settled.additionalPaymentAmount !== expectedAdditionalPayment ||
    settled.refundAmount !== expectedRefund
  ) {
    context.addIssue({
      code: "custom",
      message: "精算差額が最終金額と前受金に一致しません。",
      path: ["additionalPaymentAmount"],
    });
  }
});

export const Settled = { schema: SettledSchema } as const;

export type DepositRefunded = Readonly<{
  kind: "DepositRefunded";
  depositAmount: PaymentAmountValue;
  refundedAt: TimestampValue;
}>;

export const DepositRefunded = {
  schema: z.object({
    kind: z.literal("DepositRefunded"),
    depositAmount: PaymentAmount.schema,
    refundedAt: Timestamp.schema,
  }),
} as const;

export type SettlementState = NoPayment | DepositReceived | Settled | DepositRefunded;

export const SettlementState = {
  schema: z.union([
    NoPayment.schema,
    DepositReceived.schema,
    Settled.schema,
    DepositRefunded.schema,
  ]),
} as const;

const settle = (
  current: NoPayment | DepositReceived,
  finalAmount: PaymentAmountValue,
  settledAt: TimestampValue,
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

const isAllowedForService = (
  serviceCode: ServiceCode,
  settlement: SettlementState,
): boolean =>
  serviceCode === "Vaccination" ||
  settlement.kind === "NoPayment" ||
  (settlement.kind === "Settled" && settlement.depositAmount === 0);

export const Settlement = { isAllowedForService, settle } as const;
