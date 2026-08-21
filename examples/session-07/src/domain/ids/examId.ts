import { z } from "zod";

const schema = z.string().uuid().brand<"ExamId">();

export type ExamId = z.infer<typeof schema>;
export const ExamId = { schema, parse: schema.parse } as const;
