import type { DomainEvent } from "../aggregate/domainEvent.js";
import type { EventContext } from "../aggregate/eventContext.js";
import type { UserId } from "../user/userId.js";
import type { Session } from "./session.js";
import type { SessionId } from "./sessionId.js";

type SessionDomainEvent<
  TAggregateState extends Session | undefined,
  TKind extends string,
  TEventName extends string,
  TEventPayload extends Readonly<Record<string, unknown>>,
> = Readonly<
  Omit<
    DomainEvent<SessionId, "Session", TAggregateState, TKind, TEventName, TEventPayload>,
    "aggregateState"
  > & {
    aggregateState: TAggregateState;
  }
>;

export type SessionCreated = SessionDomainEvent<
  Session,
  "SessionCreated",
  "session.created",
  Readonly<{ sessionId: SessionId; userId: UserId }>
>;

export type SessionDeleted = SessionDomainEvent<
  undefined,
  "SessionDeleted",
  "session.deleted",
  Readonly<{ sessionId: SessionId; userId: UserId }>
>;

const create = <
  TAggregateState extends Session | undefined,
  TKind extends string,
  TEventName extends string,
  TEventPayload extends Readonly<Record<string, unknown>>,
>(
  context: EventContext,
  aggregateId: SessionId,
  aggregateState: TAggregateState,
  kind: TKind,
  eventName: TEventName,
  eventPayload: TEventPayload,
): SessionDomainEvent<TAggregateState, TKind, TEventName, TEventPayload> => ({
  kind,
  eventId: context.eventId,
  aggregateId,
  aggregateName: "Session",
  aggregateState,
  eventName,
  eventPayload,
  occurredAt: context.occurredAt,
  actorUserId: context.actorUserId,
});

export const createSessionCreated = (context: EventContext, session: Session): SessionCreated =>
  create(context, session.sessionId, session, "SessionCreated", "session.created", {
    sessionId: session.sessionId,
    userId: session.userId,
  });

export const createSessionDeleted = (context: EventContext, session: Session): SessionDeleted =>
  create(context, session.sessionId, undefined, "SessionDeleted", "session.deleted", {
    sessionId: session.sessionId,
    userId: session.userId,
  });
