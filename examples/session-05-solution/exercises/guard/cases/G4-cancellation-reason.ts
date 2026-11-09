import { z } from "zod";

import { schemaResult } from "../../../src/domain/shared/schemaResult.js";

const CancellationReasonBrand = Symbol();
const CancellationReasonSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .brand<typeof CancellationReasonBrand>();

export type CancellationReason = z.infer<typeof CancellationReasonSchema>;

export const CancellationReason = {
  schema: CancellationReasonSchema,
  parse: schemaResult(CancellationReasonSchema),
} as const;
