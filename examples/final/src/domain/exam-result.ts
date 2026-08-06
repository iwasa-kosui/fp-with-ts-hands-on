import { z } from "zod";

import { schemaResult } from "../shared/schema-result.js";
import { ExamId } from "./exam-id.js";
import { PetId } from "./pet-id.js";
import { Timestamp } from "./timestamp.js";

const ExamResultSchema = z.object({
  examId: ExamId.schema,
  petId: PetId.schema,
  collectedAt: Timestamp.schema,
  needsFollowUp: z.boolean().default(false),
  items: z.array(z.string().min(1)).min(1).readonly(),
}).readonly();

export type ExamResult = Readonly<z.infer<typeof ExamResultSchema>>;

export const ExamResult = {
  schema: ExamResultSchema,
  parse: schemaResult(ExamResultSchema),
} as const;
