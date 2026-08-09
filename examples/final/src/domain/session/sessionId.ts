import { z } from "zod";

import { schemaResult } from "../shared/schemaResult.js";

const SessionIdBrand = Symbol();
const SessionIdSchema = z.string().uuid().brand<typeof SessionIdBrand>();

export type SessionId = z.infer<typeof SessionIdSchema>;

export const SessionId = {
  schema: SessionIdSchema,
  parse: schemaResult(SessionIdSchema),
} as const;
