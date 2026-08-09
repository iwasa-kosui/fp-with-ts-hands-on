import { z } from "zod";

import { schemaResult } from "../shared/schemaResult.js";
import { Sensitive } from "../shared/sensitive.js";

const CancellationReasonBrand = Symbol();
const CancellationReasonSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .brand<typeof CancellationReasonBrand>()
  .transform(Sensitive.of);

export type CancellationReason = z.infer<typeof CancellationReasonSchema>;

export const CancellationReason = {
  schema: CancellationReasonSchema,
  parse: schemaResult(CancellationReasonSchema),
} as const;
