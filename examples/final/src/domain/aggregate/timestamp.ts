import { z } from "zod";
import { schemaResult } from "../shared/schemaResult.js";

const TimestampSchema = z.string().datetime({ offset: true }).brand<"Timestamp">();

export type Timestamp = z.infer<typeof TimestampSchema>;

export const Timestamp = {
  schema: TimestampSchema,
  parse: schemaResult(TimestampSchema),
} as const;
