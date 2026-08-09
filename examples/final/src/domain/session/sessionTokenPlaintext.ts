import { z } from "zod";

import { schemaResult } from "../shared/schemaResult.js";
import { Sensitive } from "../shared/sensitive.js";

const SessionTokenPlaintextBrand = Symbol();
const SessionTokenPlaintextSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .brand<typeof SessionTokenPlaintextBrand>()
  .transform(Sensitive.of);

export type SessionTokenPlaintext = z.infer<typeof SessionTokenPlaintextSchema>;

export const SessionTokenPlaintext = {
  schema: SessionTokenPlaintextSchema,
  parse: schemaResult(SessionTokenPlaintextSchema),
} as const;
