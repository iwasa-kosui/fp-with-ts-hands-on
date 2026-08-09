import { z } from "zod";

import { schemaResult } from "../shared/schemaResult.js";
import { Sensitive } from "../shared/sensitive.js";

const PlaintextPasswordBrand = Symbol();
const PlaintextPasswordSchema = z
  .string()
  .min(12)
  .max(200)
  .brand<typeof PlaintextPasswordBrand>()
  .transform(Sensitive.of);

export type PlaintextPassword = z.infer<typeof PlaintextPasswordSchema>;

export const PlaintextPassword = {
  schema: PlaintextPasswordSchema,
  parse: schemaResult(PlaintextPasswordSchema),
} as const;
