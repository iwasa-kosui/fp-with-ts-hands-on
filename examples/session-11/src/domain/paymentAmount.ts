import { z } from "zod";

import { schemaResult } from "./shared/schemaResult.js";

const PaymentAmountSchema = z.number().int().positive().brand<"PaymentAmount">();

export type PaymentAmount = z.output<typeof PaymentAmountSchema>;

export const PaymentAmount = {
  schema: PaymentAmountSchema,
  parse: schemaResult(PaymentAmountSchema),
} as const;
