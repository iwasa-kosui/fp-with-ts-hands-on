import type { EventId } from "./eventId.js";

export type EventContext = Readonly<{
  eventId: EventId;
  occurredAt: string;
}>;
