import { z } from "zod";

import { schemaResult } from "../shared/schemaResult.js";
import { Sensitive } from "../shared/sensitive.js";

export const OwnerContactSchema = z
  .object({
    ownerName: z.string().min(1),
    ownerEmail: z.string().email().brand<"OwnerEmail">().transform(Sensitive.of),
    ownerPhone: z.string().min(1).brand<"OwnerPhone">().transform(Sensitive.of),
  })
  .readonly();

export type OwnerContact = z.infer<typeof OwnerContactSchema>;

export const parseOwnerContact = schemaResult(OwnerContactSchema);
