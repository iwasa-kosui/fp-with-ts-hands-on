import { z } from "zod";

import { Sensitive } from "../shared/sensitive.js";
import { schemaResult } from "../shared/schemaResult.js";

const OwnerPhoneSchema = z.string().trim().min(1).max(40).brand<"OwnerPhone">().transform(Sensitive.of);

export type OwnerPhone = z.infer<typeof OwnerPhoneSchema>;

export const OwnerPhone = {
  schema: OwnerPhoneSchema,
  parse: schemaResult(OwnerPhoneSchema),
} as const;
