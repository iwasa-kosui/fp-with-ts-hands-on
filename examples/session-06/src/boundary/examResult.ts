import { z } from "zod";

import { ExamId } from "../domain/ids/examId.js";
import { PetId } from "../domain/ids/petId.js";
import { schemaResult } from "../shared/schemaResult.js";

const ExamResultSchema = z.object({
  examId: ExamId.schema,
  petId: PetId.schema,
  items: z.array(z.string().min(1)).readonly(),
  needsFollowUp: z.boolean().default(false),
}).readonly();

export type ExamResult = z.infer<typeof ExamResultSchema>;

export const ExamResult = {
  schema: ExamResultSchema,
  parse: schemaResult(ExamResultSchema),
} as const;
