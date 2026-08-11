import type { AppointmentId } from "../appointmentId.js";
import type { OwnerContact } from "../ownerContact.js";
import type { PetId } from "../petId.js";
import type { Timestamp } from "../timestamp.js";
import type { UserId } from "../user/userId.js";

export type FollowUpRequested = Readonly<{
  kind: "FollowUpRequested";
  aggregateId: AppointmentId;
  eventPayload: Readonly<{
    appointmentId: AppointmentId;
    petId: PetId;
  }>;
  occurredAt?: Timestamp;
  actorUserId?: UserId;
}>;

export type UnsafeFollowUpRequested = FollowUpRequested &
  Readonly<{ ownerContact: OwnerContact }>;
