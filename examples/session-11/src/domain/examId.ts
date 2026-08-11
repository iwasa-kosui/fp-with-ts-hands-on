import { z } from "zod";

import { schemaResult } from "./shared/schemaResult.js";

const ExamIdSchema = z.string().uuid().brand<"ExamId">();

export type ExamId = z.output<typeof ExamIdSchema>;

export const ExamId = {
  schema: ExamIdSchema,
  parse: schemaResult(ExamIdSchema),
} as const;
