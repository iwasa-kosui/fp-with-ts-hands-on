import type { AppointmentId } from "../appointment/index.js";
import type { OwnerPhone } from "../owner/index.js";
import type { PetId } from "../pet/index.js";
import type { FollowUpCandidate } from "./followUpCandidate.js";

export type FollowUpTarget = Readonly<{
  appointmentId: AppointmentId;
  petId: PetId;
  ownerPhone: OwnerPhone;
}>;

const fromCandidate = (candidate: FollowUpCandidate): FollowUpTarget => ({
  appointmentId: candidate.appointment.appointmentId,
  petId: candidate.appointment.petId,
  ownerPhone: candidate.owner.phone,
});

export const FollowUpTarget = { fromCandidate } as const;
