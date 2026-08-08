import { z } from "zod";

import { schemaResult } from "../shared/schemaResult.js";
import { Sensitive } from "../shared/sensitive.js";

const TreatmentBrand = Symbol();
const TreatmentSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .brand<typeof TreatmentBrand>()
  .transform(Sensitive.of);

export type Treatment = z.infer<typeof TreatmentSchema>;

export const Treatment = {
  schema: TreatmentSchema,
  parse: schemaResult(TreatmentSchema),
} as const;
