import type { AppointmentId } from "./appointment-id.js";
import type { EventId } from "./event-id.js";
import type { PetId } from "./pet-id.js";
import type { Timestamp } from "./timestamp.js";

export type FollowUpRequested = Readonly<{
  kind: "FollowUpRequested";
  eventId: EventId;
  occurredAt: Timestamp;
  appointmentId: AppointmentId;
  petId: PetId;
}>;

export type CreateFollowUpRequestedInput = Readonly<Omit<FollowUpRequested, "kind">>;

export const FollowUpRequested = {
  create: (input: CreateFollowUpRequestedInput): FollowUpRequested => ({
    kind: "FollowUpRequested",
    ...input,
  }),
} as const;
