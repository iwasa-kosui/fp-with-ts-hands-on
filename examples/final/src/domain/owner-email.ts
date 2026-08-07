import { z } from "zod";

import { schemaResult } from "../shared/schema-result.js";

const OwnerEmailBrand = Symbol();
const OwnerEmailSchema = z
  .string()
  .trim()
  .email()
  .brand<typeof OwnerEmailBrand>();

export type OwnerEmail = z.infer<typeof OwnerEmailSchema>;

export const OwnerEmail = {
  schema: OwnerEmailSchema,
  parse: schemaResult(OwnerEmailSchema),
} as const;
