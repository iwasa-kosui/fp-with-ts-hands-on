import { z } from "zod";

import { schemaResult } from "../shared/schema-result.js";

const OwnerNameBrand = Symbol();
const OwnerNameSchema = z
  .string()
  .trim()
  .min(1)
  .brand<typeof OwnerNameBrand>();

export type OwnerName = z.infer<typeof OwnerNameSchema>;

export const OwnerName = {
  schema: OwnerNameSchema,
  parse: schemaResult(OwnerNameSchema),
} as const;
