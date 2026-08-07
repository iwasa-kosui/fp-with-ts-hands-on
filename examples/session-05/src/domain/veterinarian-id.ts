import { z } from "zod";

import { schemaResult } from "../shared/schema-result.js";

export const VeterinarianIdBrand = Symbol();

const VeterinarianIdSchema = z.string().uuid().brand<typeof VeterinarianIdBrand>();

export type VeterinarianId = z.infer<typeof VeterinarianIdSchema>;

export const VeterinarianId = {
  schema: VeterinarianIdSchema,
  parse: schemaResult<VeterinarianId>(VeterinarianIdSchema),
} as const;
