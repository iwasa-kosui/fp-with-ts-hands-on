import { z } from "zod";

import { schemaResult } from "../shared/schemaResult.js";

const PetSpeciesBrand = Symbol();
const PetSpeciesSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .brand<typeof PetSpeciesBrand>();

export type PetSpecies = z.infer<typeof PetSpeciesSchema>;

export const PetSpecies = {
  schema: PetSpeciesSchema,
  parse: schemaResult(PetSpeciesSchema),
} as const;
