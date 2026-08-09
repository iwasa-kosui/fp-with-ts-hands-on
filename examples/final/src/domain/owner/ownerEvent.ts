import type { DomainEvent } from "../aggregate/domainEvent.js";
import type { EventContext } from "../aggregate/eventContext.js";
import type { Owner } from "./owner.js";
import type { OwnerId } from "./ownerId.js";

type OwnerDomainEvent<
  TAggregateState extends Owner | undefined,
  TKind extends string,
  TEventName extends string,
> = Readonly<
  Omit<
    DomainEvent<
      OwnerId,
      "Owner",
      TAggregateState,
      TKind,
      TEventName,
      Readonly<{ ownerId: OwnerId }>
    >,
    "aggregateState"
  > & {
    aggregateState: TAggregateState;
  }
>;

export type OwnerCreated = OwnerDomainEvent<Owner, "OwnerCreated", "owner.created">;
export type OwnerUpdated = OwnerDomainEvent<Owner, "OwnerUpdated", "owner.updated">;
export type OwnerDeleted = OwnerDomainEvent<undefined, "OwnerDeleted", "owner.deleted">;

export type OwnerEvent = OwnerCreated | OwnerUpdated | OwnerDeleted;

const create = <
  TAggregateState extends Owner | undefined,
  TKind extends string,
  TEventName extends string,
>(
  context: EventContext,
  aggregateId: OwnerId,
  aggregateState: TAggregateState,
  kind: TKind,
  eventName: TEventName,
): OwnerDomainEvent<TAggregateState, TKind, TEventName> => ({
  kind,
  eventId: context.eventId,
  aggregateId,
  aggregateName: "Owner",
  aggregateState,
  eventName,
  eventPayload: { ownerId: aggregateId },
  occurredAt: context.occurredAt,
  actorUserId: context.actorUserId,
});

export const createOwnerCreated = (context: EventContext, owner: Owner): OwnerCreated =>
  create(context, owner.ownerId, owner, "OwnerCreated", "owner.created");

export const createOwnerUpdated = (context: EventContext, owner: Owner): OwnerUpdated =>
  create(context, owner.ownerId, owner, "OwnerUpdated", "owner.updated");

export const createOwnerDeleted = (context: EventContext, ownerId: OwnerId): OwnerDeleted =>
  create(context, ownerId, undefined, "OwnerDeleted", "owner.deleted");
