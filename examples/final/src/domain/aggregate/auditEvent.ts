import type { DomainEvent } from "./domainEvent.js";
import type { EventContext } from "./eventContext.js";
import type { EventId } from "./eventId.js";
import type { Timestamp } from "./timestamp.js";
import type { UserId } from "../user/userId.js";

export type SensitiveAuditPayloadViewed = DomainEvent<
  EventId,
  "Audit",
  undefined,
  "SensitiveAuditPayloadViewed",
  "audit.sensitive-payload-viewed",
  Readonly<{
    targetEventId: EventId;
    viewerUserId: UserId;
    viewedAt: Timestamp;
  }>
>;

export const createSensitiveAuditPayloadViewed = (
  context: EventContext,
  targetEventId: EventId,
): SensitiveAuditPayloadViewed => ({
  kind: "SensitiveAuditPayloadViewed",
  eventId: context.eventId,
  aggregateId: targetEventId,
  aggregateName: "Audit",
  aggregateState: undefined,
  eventName: "audit.sensitive-payload-viewed",
  eventPayload: {
    targetEventId,
    viewerUserId: context.actorUserId,
    viewedAt: context.occurredAt,
  },
  occurredAt: context.occurredAt,
  actorUserId: context.actorUserId,
});
