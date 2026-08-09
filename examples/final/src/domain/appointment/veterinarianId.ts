import { z } from "zod";

import { schemaResult } from "../shared/schemaResult.js";

const VeterinarianIdBrand = Symbol();
const VeterinarianIdSchema = z.string().uuid().brand<typeof VeterinarianIdBrand>();

export type VeterinarianId = z.infer<typeof VeterinarianIdSchema>;

export const VeterinarianId = {
  schema: VeterinarianIdSchema,
  parse: schemaResult(VeterinarianIdSchema),
} as const;
