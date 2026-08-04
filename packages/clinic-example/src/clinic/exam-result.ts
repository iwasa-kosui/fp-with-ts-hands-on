import { z } from "zod";
import { PetId, type PetId as PetIdValue } from "./pet-id.js";

const ExamResultSchema = z.object({
  examId: z.string().min(1),
  petId: PetId.schema,
  collectedAt: z.string().datetime(),
  needsFollowUp: z.boolean().default(false),
  items: z.array(z.object({
    code: z.string().min(1),
    value: z.number(),
    unit: z.string().min(1),
  })).min(1),
});

export type ExamResult = Readonly<{
  examId: string;
  petId: PetIdValue;
  collectedAt: string;
  needsFollowUp: boolean;
  items: ReadonlyArray<Readonly<{ code: string; value: number; unit: string }>>;
}>;

export const ExamResult: Readonly<{
  schema: typeof ExamResultSchema;
  safeParse: (raw: unknown) => z.SafeParseReturnType<unknown, ExamResult>;
}> = {
  schema: ExamResultSchema,
  safeParse: (raw) => ExamResultSchema.safeParse(raw),
};
