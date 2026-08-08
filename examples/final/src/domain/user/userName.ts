import { z } from "zod";

import { Sensitive } from "../shared/sensitive.js";
import { schemaResult } from "../shared/schemaResult.js";

const UserNameBrand = Symbol();
const UserNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .brand<typeof UserNameBrand>()
  .transform(Sensitive.of);

export type UserName = z.infer<typeof UserNameSchema>;

export const UserName = {
  schema: UserNameSchema,
  parse: schemaResult(UserNameSchema),
} as const;
