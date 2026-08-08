import type { AppointmentId } from "../appointment/appointmentId.js";
import type { OwnerPhone } from "../owner/ownerPhone.js";
import type { PetId } from "../pet/petId.js";
import type { FollowUpCandidate } from "./followUpCandidate.js";
import { FollowUpRequested, type FollowUpRequested as FollowUpRequestedEvent } from "./followUpRequested.js";

export type FollowUpTarget = Readonly<{
  appointmentId: AppointmentId;
  petId: PetId;
  ownerPhone: OwnerPhone;
  event: FollowUpRequestedEvent;
}>;

const fromCandidate = (candidate: FollowUpCandidate): FollowUpTarget => ({
  appointmentId: candidate.appointment.appointmentId,
  petId: candidate.appointment.petId,
  ownerPhone: candidate.owner.phone,
  event: FollowUpRequested.create(
    candidate.context,
    candidate.appointment.appointmentId,
    candidate.appointment.petId,
  ),
});

export const FollowUpTarget = { fromCandidate } as const;
