import { z } from "zod";

import { schemaResult } from "../shared/schemaResult.js";

const PetIdBrand = Symbol();
const PetIdSchema = z.string().uuid().brand<typeof PetIdBrand>();

export type PetId = z.infer<typeof PetIdSchema>;

export const PetId = {
  schema: PetIdSchema,
  parse: schemaResult(PetIdSchema),
} as const;
