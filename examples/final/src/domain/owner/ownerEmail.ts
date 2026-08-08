import { z } from "zod";

import { Sensitive } from "../shared/sensitive.js";
import { schemaResult } from "../shared/schemaResult.js";

const OwnerEmailSchema = z.string().trim().email().brand<"OwnerEmail">().transform(Sensitive.of);

export type OwnerEmail = z.infer<typeof OwnerEmailSchema>;

export const OwnerEmail = {
  schema: OwnerEmailSchema,
  parse: schemaResult(OwnerEmailSchema),
} as const;
