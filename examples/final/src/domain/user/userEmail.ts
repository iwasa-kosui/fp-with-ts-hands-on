import { z } from "zod";

import { Sensitive } from "../shared/sensitive.js";
import { schemaResult } from "../shared/schemaResult.js";

const UserEmailBrand = Symbol();
const UserEmailSchema = z
  .string()
  .email()
  .brand<typeof UserEmailBrand>()
  .transform(Sensitive.of);

export type UserEmail = z.infer<typeof UserEmailSchema>;

export const UserEmail = {
  schema: UserEmailSchema,
  parse: schemaResult(UserEmailSchema),
} as const;
