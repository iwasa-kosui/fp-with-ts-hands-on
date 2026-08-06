import { z } from "zod";

import { schemaResult } from "../shared/schema-result.js";

const OwnerPhoneBrand = Symbol();
const OwnerPhoneSchema = z
  .string()
  .trim()
  .min(1)
  .brand<typeof OwnerPhoneBrand>();

export type OwnerPhone = z.infer<typeof OwnerPhoneSchema>;

export const OwnerPhone = {
  schema: OwnerPhoneSchema,
  parse: schemaResult(OwnerPhoneSchema),
} as const;
