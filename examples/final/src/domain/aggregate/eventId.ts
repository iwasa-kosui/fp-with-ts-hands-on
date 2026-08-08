import { z } from "zod";
import { schemaResult } from "../shared/schemaResult.js";

const EventIdSchema = z.string().uuid().brand<"EventId">();

export type EventId = z.infer<typeof EventIdSchema>;

export const EventId = {
  schema: EventIdSchema,
  parse: schemaResult(EventIdSchema),
} as const;
