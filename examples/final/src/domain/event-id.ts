import { z } from "zod";

import { schemaResult } from "../shared/schema-result.js";

const EventIdBrand = Symbol();
const EventIdSchema = z.string().uuid().brand<typeof EventIdBrand>();

export type EventId = z.infer<typeof EventIdSchema>;

export const EventId = {
  schema: EventIdSchema,
  parse: schemaResult(EventIdSchema),
} as const;
