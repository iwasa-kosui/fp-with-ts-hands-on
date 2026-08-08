import { z } from "zod";

import { Sensitive } from "../shared/sensitive.js";
import { schemaResult } from "../shared/schemaResult.js";

const PasswordHashBrand = Symbol();
const PasswordHashSchema = z
  .string()
  .regex(/^scrypt\$[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{86}==$/)
  .brand<typeof PasswordHashBrand>()
  .transform(Sensitive.of);

export type PasswordHash = z.infer<typeof PasswordHashSchema>;

export const PasswordHash = {
  schema: PasswordHashSchema,
  parse: schemaResult(PasswordHashSchema),
} as const;
