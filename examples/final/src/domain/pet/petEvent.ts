import type { DomainEvent } from "../aggregate/domainEvent.js";
import type { EventContext } from "../aggregate/eventContext.js";
import type { OwnerId } from "../owner/ownerId.js";
import type { Pet } from "./pet.js";
import type { PetId } from "./petId.js";

type PetEventPayload = Readonly<{ petId: PetId; ownerId: OwnerId }>;

type PetDomainEvent<
  TAggregateState extends Pet | undefined,
  TKind extends string,
  TEventName extends string,
> = Readonly<
  Omit<DomainEvent<PetId, "Pet", TAggregateState, TKind, TEventName, PetEventPayload>, "aggregateState"> & {
    aggregateState: TAggregateState;
  }
>;

export type PetCreated = PetDomainEvent<Pet, "PetCreated", "pet.created">;
export type PetUpdated = PetDomainEvent<Pet, "PetUpdated", "pet.updated">;
export type PetDeleted = PetDomainEvent<undefined, "PetDeleted", "pet.deleted">;

export type PetEvent = PetCreated | PetUpdated | PetDeleted;

const create = <
  TAggregateState extends Pet | undefined,
  TKind extends string,
  TEventName extends string,
>(
  context: EventContext,
  aggregateId: PetId,
  ownerId: OwnerId,
  aggregateState: TAggregateState,
  kind: TKind,
  eventName: TEventName,
): PetDomainEvent<TAggregateState, TKind, TEventName> => ({
  kind,
  eventId: context.eventId,
  aggregateId,
  aggregateName: "Pet",
  aggregateState,
  eventName,
  eventPayload: { petId: aggregateId, ownerId },
  occurredAt: context.occurredAt,
  actorUserId: context.actorUserId,
});

export const PetEvent = { create } as const;
