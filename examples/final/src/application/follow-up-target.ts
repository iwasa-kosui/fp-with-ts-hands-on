import { FollowUpRequested } from "../domain/follow-up-requested.js";
import type { AppointmentId } from "../domain/appointment-id.js";
import type { OwnerPhone } from "../domain/owner-phone.js";
import type { PetId } from "../domain/pet-id.js";
import type { Sensitive } from "../shared/sensitive.js";
import type { FollowUpCandidate } from "./follow-up-candidate.js";

export type FollowUpTarget = Readonly<{
  appointmentId: AppointmentId;
  petId: PetId;
  ownerPhone: Sensitive<OwnerPhone>;
  event: FollowUpRequested;
}>;

export const FollowUpTarget = {
  fromCandidate: (candidate: FollowUpCandidate): FollowUpTarget => ({
    appointmentId: candidate.appointment.appointmentId,
    petId: candidate.appointment.petId,
    ownerPhone: candidate.ownerContact.ownerPhone,
    event: FollowUpRequested.create({
      eventId: candidate.eventId,
      occurredAt: candidate.occurredAt,
      appointmentId: candidate.appointment.appointmentId,
      petId: candidate.appointment.petId,
    }),
  }),
} as const;
