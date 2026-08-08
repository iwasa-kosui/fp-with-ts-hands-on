import { z } from "zod";

import { Sensitive } from "../shared/sensitive.js";
import { schemaResult } from "../shared/schemaResult.js";

const SessionTokenHashSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .transform(Sensitive.of);

export type SessionTokenHash = z.infer<typeof SessionTokenHashSchema>;

export const SessionTokenHash = {
  schema: SessionTokenHashSchema,
  parse: schemaResult(SessionTokenHashSchema),
} as const;
