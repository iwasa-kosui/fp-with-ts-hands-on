import { ok, type Result } from "neverthrow";

import type { Appointment } from "../appointment.js";
import type { AppointmentId } from "../appointmentId.js";
import type { OwnerContact } from "../ownerContact.js";
import type { PetId } from "../petId.js";
import type {
  FollowUpRequested,
  UnsafeFollowUpRequested,
} from "./followUpRequested.js";

export type FollowUpCandidate = Readonly<{
  appointment: Appointment;
  ownerContact: OwnerContact;
  needsFollowUp: boolean;
}>;

export type FollowUpTarget = Readonly<{
  appointmentId: AppointmentId;
  petId: PetId;
  ownerContact: OwnerContact;
  event: FollowUpRequested;
}>;

const hasAppointmentId = (
  targets: readonly FollowUpTarget[],
  appointmentId: AppointmentId,
): boolean => targets.some((target) => target.appointmentId === appointmentId);

export const collectFollowUpTargets = (
  candidates: readonly FollowUpCandidate[],
): Result<readonly FollowUpTarget[], never> =>
  ok(
    candidates
      .filter(
        (candidate) =>
          candidate.appointment.kind === "Paid" && candidate.needsFollowUp,
      )
      .reduce<readonly FollowUpTarget[]>((targets, candidate) => {
        if (hasAppointmentId(targets, candidate.appointment.appointmentId)) {
          return targets;
        }

        const event: UnsafeFollowUpRequested = {
          kind: "FollowUpRequested",
          aggregateId: candidate.appointment.appointmentId,
          eventPayload: {
            appointmentId: candidate.appointment.appointmentId,
            petId: candidate.appointment.petId,
          },
          ownerContact: candidate.ownerContact,
        };

        return [
          ...targets,
          {
            appointmentId: candidate.appointment.appointmentId,
            petId: candidate.appointment.petId,
            ownerContact: candidate.ownerContact,
            event,
          },
        ];
      }, []),
  );
