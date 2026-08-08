import { z } from "zod";

import { schemaResult } from "../shared/schemaResult.js";
import { Sensitive } from "../shared/sensitive.js";

const ExamResultItemBrand = Symbol();
const ExamResultItemSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_000)
  .brand<typeof ExamResultItemBrand>()
  .transform(Sensitive.of);

export type ExamResultItem = z.infer<typeof ExamResultItemSchema>;

export const ExamResultItem = {
  schema: ExamResultItemSchema,
  parse: schemaResult(ExamResultItemSchema),
} as const;
