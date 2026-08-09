import type { EventId } from "./eventId.js";
import type { Timestamp } from "./timestamp.js";
import type { UserId } from "../user/userId.js";

export type DomainEvent<
  TAggregateId,
  TAggregateName extends string,
  TAggregateState,
  TKind extends string,
  TEventName extends string,
  TEventPayload extends Readonly<Record<string, unknown>>,
> = Readonly<{
  kind: TKind;
  eventId: EventId;
  aggregateId: TAggregateId;
  aggregateName: TAggregateName;
  aggregateState: TAggregateState | undefined;
  eventName: TEventName;
  eventPayload: TEventPayload;
  occurredAt: Timestamp;
  actorUserId: UserId;
}>;

export type AnyDomainEvent = DomainEvent<
  unknown,
  string,
  unknown,
  string,
  string,
  Readonly<Record<string, unknown>>
>;
