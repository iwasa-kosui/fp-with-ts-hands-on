import { z } from "zod";

import { Sensitive } from "../shared/sensitive.js";
import { schemaResult } from "../shared/schemaResult.js";

const PasswordHashSchema = z.string().min(1).transform(Sensitive.of);

export type PasswordHash = z.infer<typeof PasswordHashSchema>;

export const PasswordHash = {
  schema: PasswordHashSchema,
  parse: schemaResult(PasswordHashSchema),
} as const;
