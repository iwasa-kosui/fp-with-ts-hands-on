import type { EventId } from "./eventId.js";

export type EventIdGenerator = Readonly<{
  generate: () => EventId;
}>;
