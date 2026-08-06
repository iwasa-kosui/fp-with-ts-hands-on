import { z } from "zod";

import { schemaResult } from "../shared/schema-result.js";

const PaymentAmountBrand = Symbol();
const PaymentAmountSchema = z
  .number()
  .finite()
  .positive()
  .brand<typeof PaymentAmountBrand>();

export type PaymentAmount = z.infer<typeof PaymentAmountSchema>;

export const PaymentAmount = {
  schema: PaymentAmountSchema,
  parse: schemaResult(PaymentAmountSchema),
} as const;
