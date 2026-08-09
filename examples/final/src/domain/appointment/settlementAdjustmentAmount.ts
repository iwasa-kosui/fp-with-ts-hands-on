import { z } from "zod";

import { schemaResult } from "../shared/schemaResult.js";

const SettlementAdjustmentAmountSchema = z
  .number()
  .int()
  .nonnegative()
  .brand<"SettlementAdjustmentAmount">();

export type SettlementAdjustmentAmount = z.infer<typeof SettlementAdjustmentAmountSchema>;

export const SettlementAdjustmentAmount = {
  schema: SettlementAdjustmentAmountSchema,
  parse: schemaResult(SettlementAdjustmentAmountSchema),
} as const;
