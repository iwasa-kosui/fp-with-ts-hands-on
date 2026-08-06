import { z } from "zod";

import { schemaResult } from "../shared/schema-result.js";
import { Sensitive } from "../shared/sensitive.js";

const OwnerContactSchema = z.object({
  ownerName: z.string().min(1).transform(Sensitive.of),
  ownerEmail: z.string().email().transform(Sensitive.of),
  ownerPhone: z.string().min(1).transform(Sensitive.of),
}).readonly();

export type OwnerContact = Readonly<z.infer<typeof OwnerContactSchema>>;

export const OwnerContact = {
  schema: OwnerContactSchema,
  parse: schemaResult(OwnerContactSchema),
} as const;
