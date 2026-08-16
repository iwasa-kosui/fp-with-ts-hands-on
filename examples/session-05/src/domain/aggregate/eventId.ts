import { z } from "zod";

const schema = z.string().uuid().brand<"EventId">();

export type EventId = z.infer<typeof schema>;
export const EventId = { schema, parse: schema.parse } as const;
