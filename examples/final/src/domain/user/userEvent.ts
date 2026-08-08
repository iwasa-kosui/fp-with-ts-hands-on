import type { DomainEvent } from "../aggregate/domainEvent.js";
import type { EventContext } from "../aggregate/eventContext.js";
import type { User } from "./user.js";
import type { UserId } from "./userId.js";

type UserDomainEvent<
  TAggregateState extends User | undefined,
  TKind extends string,
  TEventName extends string,
  TEventPayload extends Readonly<Record<string, unknown>>,
> = Readonly<
  Omit<
    DomainEvent<UserId, "User", TAggregateState, TKind, TEventName, TEventPayload>,
    "aggregateState"
  > & {
    aggregateState: TAggregateState;
  }
>;

export type UserCreated = UserDomainEvent<
  User,
  "UserCreated",
  "user.created",
  Readonly<{ userId: UserId; role: User["kind"] }>
>;

export type UserUpdated = UserDomainEvent<
  User,
  "UserUpdated",
  "user.updated",
  Readonly<{ userId: UserId; role: User["kind"] }>
>;

export type UserPasswordReset = UserDomainEvent<
  User,
  "UserPasswordReset",
  "user.password-reset",
  Readonly<{ userId: UserId }>
>;

export type UserDeleted = UserDomainEvent<
  undefined,
  "UserDeleted",
  "user.deleted",
  Readonly<{ userId: UserId }>
>;

export type UserEvent = UserCreated | UserUpdated | UserPasswordReset | UserDeleted;

const create = <
  TAggregateState extends User | undefined,
  TKind extends string,
  TEventName extends string,
  TEventPayload extends Readonly<Record<string, unknown>>,
>(
  context: EventContext,
  aggregateId: UserId,
  aggregateState: TAggregateState,
  kind: TKind,
  eventName: TEventName,
  eventPayload: TEventPayload,
): UserDomainEvent<TAggregateState, TKind, TEventName, TEventPayload> => ({
  kind,
  eventId: context.eventId,
  aggregateId,
  aggregateName: "User",
  aggregateState,
  eventName,
  eventPayload,
  occurredAt: context.occurredAt,
  actorUserId: context.actorUserId,
});

export const UserEvent = { create } as const;
