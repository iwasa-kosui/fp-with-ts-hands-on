import { z } from "zod";

import { schemaResult } from "../shared/schema-result.js";

export const TimestampBrand = Symbol();

const TimestampSchema = z.string().datetime().brand<typeof TimestampBrand>();

export type Timestamp = z.infer<typeof TimestampSchema>;

export const Timestamp = {
  schema: TimestampSchema,
  parse: schemaResult<Timestamp>(TimestampSchema),
} as const;
