import { z } from "zod";

import { schemaResult } from "../shared/schemaResult.js";

const PaymentAmountBrand = Symbol();
const PaymentAmountSchema = z.number().int().positive().brand<typeof PaymentAmountBrand>();

export type PaymentAmount = z.infer<typeof PaymentAmountSchema>;

export const PaymentAmount = {
  schema: PaymentAmountSchema,
  parse: schemaResult(PaymentAmountSchema),
} as const;
