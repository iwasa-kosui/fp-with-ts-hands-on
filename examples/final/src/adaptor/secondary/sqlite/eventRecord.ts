import type { AnyDomainEvent } from "../../../domain/aggregate/domainEvent.js";

export type EventRecord = Readonly<{
  eventId: string;
  aggregateId: string;
  aggregateName: string;
  aggregateState: unknown | null;
  eventName: string;
  eventPayload: Readonly<Record<string, unknown>>;
  occurredAt: string;
  actorUserId: string;
}>;

export const toEventRecord = (
  event: AnyDomainEvent,
  aggregateState: unknown,
  eventPayload: Readonly<Record<string, unknown>>,
): EventRecord => ({
  eventId: String(event.eventId),
  aggregateId: String(event.aggregateId),
  aggregateName: event.aggregateName,
  aggregateState: aggregateState ?? null,
  eventName: event.eventName,
  eventPayload,
  occurredAt: String(event.occurredAt),
  actorUserId: String(event.actorUserId),
});
