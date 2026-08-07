import { z } from "zod";

import { schemaResult } from "../shared/schema-result.js";

export const ExamIdBrand = Symbol();

const ExamIdSchema = z.string().uuid().brand<typeof ExamIdBrand>();

export type ExamId = z.infer<typeof ExamIdSchema>;

export const ExamId = {
  schema: ExamIdSchema,
  parse: schemaResult<ExamId>(ExamIdSchema),
} as const;
