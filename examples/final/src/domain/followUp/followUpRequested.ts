import type { DomainEvent } from "../aggregate/domainEvent.js";
import type { EventContext } from "../aggregate/eventContext.js";
import type { AppointmentId } from "../appointment/index.js";
import type { PetId } from "../pet/index.js";

export type FollowUpRequested = DomainEvent<
  AppointmentId,
  "FollowUp",
  undefined,
  "FollowUpRequested",
  "follow-up.requested",
  Readonly<{ appointmentId: AppointmentId; petId: PetId }>
>;

const create = (
  context: EventContext,
  appointmentId: AppointmentId,
  petId: PetId,
): FollowUpRequested => ({
  kind: "FollowUpRequested",
  eventId: context.eventId,
  aggregateId: appointmentId,
  aggregateName: "FollowUp",
  aggregateState: undefined,
  eventName: "follow-up.requested",
  eventPayload: { appointmentId, petId },
  occurredAt: context.occurredAt,
  actorUserId: context.actorUserId,
});

export const FollowUpRequested = { create } as const;
