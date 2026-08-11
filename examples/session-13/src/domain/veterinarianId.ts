import { z } from "zod";

import { schemaResult } from "./shared/schemaResult.js";

const VeterinarianIdSchema = z.string().uuid().brand<"VeterinarianId">();

export type VeterinarianId = z.output<typeof VeterinarianIdSchema>;

export const VeterinarianId = {
  schema: VeterinarianIdSchema,
  parse: schemaResult(VeterinarianIdSchema),
} as const;
