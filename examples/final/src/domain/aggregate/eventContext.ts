import type { EventId } from "./eventId.js";
import type { Timestamp } from "./timestamp.js";
import type { UserId } from "../user/userId.js";

export type EventContext = Readonly<{
  eventId: EventId;
  occurredAt: Timestamp;
  actorUserId: UserId;
}>;
