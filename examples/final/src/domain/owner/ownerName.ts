import { z } from "zod";

import { Sensitive } from "../shared/sensitive.js";
import { schemaResult } from "../shared/schemaResult.js";

const OwnerNameSchema = z.string().trim().min(1).max(100).brand<"OwnerName">().transform(Sensitive.of);

export type OwnerName = z.infer<typeof OwnerNameSchema>;

export const OwnerName = {
  schema: OwnerNameSchema,
  parse: schemaResult(OwnerNameSchema),
} as const;
