import { z } from "zod";

import { schemaResult } from "../../../domain/shared/schemaResult.js";
import { Sensitive } from "../../../domain/shared/sensitive.js";

const OwnerContactSchema = z
  .object({
    ownerName: z.string().min(1).brand<"OwnerName">().transform(Sensitive.of),
    ownerEmail: z.string().email().brand<"OwnerEmail">().transform(Sensitive.of),
    ownerPhone: z.string().min(1).brand<"OwnerPhone">().transform(Sensitive.of),
  })
  .readonly();

export type OwnerContact = z.infer<typeof OwnerContactSchema>;

export const OwnerContact = {
  schema: OwnerContactSchema,
  parse: schemaResult(OwnerContactSchema),
} as const;
