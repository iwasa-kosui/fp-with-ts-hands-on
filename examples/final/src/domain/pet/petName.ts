import { z } from "zod";

import { schemaResult } from "../shared/schemaResult.js";
import { Sensitive } from "../shared/sensitive.js";

const PetNameBrand = Symbol();
const PetNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .brand<typeof PetNameBrand>()
  .transform(Sensitive.of);

export type PetName = z.infer<typeof PetNameSchema>;

export const PetName = {
  schema: PetNameSchema,
  parse: schemaResult(PetNameSchema),
} as const;
