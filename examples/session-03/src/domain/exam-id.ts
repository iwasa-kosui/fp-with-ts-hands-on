import { z } from "zod";

export const ExamIdBrand = Symbol();

const ExamIdSchema = z.string().uuid().brand<typeof ExamIdBrand>();

export type ExamId = z.infer<typeof ExamIdSchema>;

export const ExamId = {
  schema: ExamIdSchema,
  safeParse: (raw: unknown) => ExamIdSchema.safeParse(raw),
} as const;
