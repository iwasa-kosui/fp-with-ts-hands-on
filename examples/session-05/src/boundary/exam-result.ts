import { z } from "zod";

import { ExamId } from "../domain/exam-id.js";
import { PetId } from "../domain/pet-id.js";
import { Timestamp } from "../domain/timestamp.js";
import { schemaResult } from "../shared/schema-result.js";

const ExamResultSchema = z.object({
  examId: ExamId.schema,
  petId: PetId.schema,
  collectedAt: Timestamp.schema,
  needsFollowUp: z.boolean().default(false),
  items: z.array(z.string().min(1)).min(1),
});

export type ExamResult = z.infer<typeof ExamResultSchema>;

export const ExamResult = {
  schema: ExamResultSchema,
  parse: schemaResult(ExamResultSchema),
} as const;
