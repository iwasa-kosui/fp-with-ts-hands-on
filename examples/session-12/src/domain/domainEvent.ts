import type { Timestamp } from "./timestamp.js";

export type EventContext = Readonly<{
  occurredAt: Timestamp;
}>;

export type DomainEvent<
  TAggregateId,
  TAggregateName extends string,
  TAggregateState,
  TKind extends string,
  TEventName extends string,
  TEventPayload extends Readonly<Record<string, unknown>>,
> = Readonly<{
  kind: TKind;
  aggregateId: TAggregateId;
  aggregateName: TAggregateName;
  aggregateState: TAggregateState;
  eventName: TEventName;
  eventPayload: TEventPayload;
  occurredAt: Timestamp;
}>;
