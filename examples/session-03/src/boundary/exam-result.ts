import { z } from "zod";

import { ExamId } from "../domain/exam-id.js";
import { PetId } from "../domain/pet-id.js";

const ExamResultSchema = z.object({
  examId: ExamId.schema,
  petId: PetId.schema,
  collectedAt: z.string().datetime(),
  needsFollowUp: z.boolean().default(false),
  items: z.array(z.string().min(1)).min(1),
});

export type ExamResult = z.infer<typeof ExamResultSchema>;

export const ExamResult = {
  schema: ExamResultSchema,
  safeParse: (raw: unknown) => ExamResultSchema.safeParse(raw),
} as const;
