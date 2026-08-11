import { z } from "zod";

import { schemaResult } from "./shared/schemaResult.js";

const PetIdSchema = z.string().uuid();

export type PetId = z.output<typeof PetIdSchema>;

export const PetId = {
  schema: PetIdSchema,
  parse: schemaResult(PetIdSchema),
} as const;
