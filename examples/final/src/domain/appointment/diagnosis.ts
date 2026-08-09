import { z } from "zod";

import { schemaResult } from "../shared/schemaResult.js";
import { Sensitive } from "../shared/sensitive.js";

const DiagnosisBrand = Symbol();
const DiagnosisSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .brand<typeof DiagnosisBrand>()
  .transform(Sensitive.of);

export type Diagnosis = z.infer<typeof DiagnosisSchema>;

export const Diagnosis = {
  schema: DiagnosisSchema,
  parse: schemaResult(DiagnosisSchema),
} as const;
