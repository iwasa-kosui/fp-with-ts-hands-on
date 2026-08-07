import { z } from "zod";

import { Sensitive } from "../shared/sensitive.js";
import { schemaResult } from "../shared/schema-result.js";

const OwnerContactSchema = z
  .object({
    ownerName: z.string().min(1),
    ownerEmail: z.string().email(),
    ownerPhone: z.string().min(1),
  })
  .transform(({ ownerName, ownerEmail, ownerPhone }) => ({
    ownerName: Sensitive.of(ownerName),
    ownerEmail: Sensitive.of(ownerEmail),
    ownerPhone: Sensitive.of(ownerPhone),
  }));

export type OwnerContact = z.infer<typeof OwnerContactSchema>;

export const OwnerContact = {
  schema: OwnerContactSchema,
  parse: schemaResult(OwnerContactSchema),
} as const;
