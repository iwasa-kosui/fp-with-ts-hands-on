import { err, ok, type Result } from "neverthrow";

import type { AppointmentId } from "../appointment/appointmentId.js";
import type { PetId } from "../pet/petId.js";
import { FollowUpCandidate as FollowUpCandidateModel, type FollowUpCandidate as Candidate } from "./followUpCandidate.js";
import { FollowUpTarget as FollowUpTargetModel, type FollowUpTarget as Target } from "./followUpTarget.js";

export type ExamResultPetMismatch = Readonly<{
  kind: "ExamResultPetMismatch";
  appointmentId: AppointmentId;
  expectedPetId: PetId;
  actualPetId: PetId;
}>;

export type CollectFollowUpTargetsError = ExamResultPetMismatch;
export type FollowUpCandidate = Candidate;
export type FollowUpTarget = Target;

const validateCandidate = (
  candidate: Candidate,
): Result<Candidate, CollectFollowUpTargetsError> =>
  FollowUpCandidateModel.matchesPet(candidate)
    ? ok(candidate)
    : err({
        kind: "ExamResultPetMismatch",
        appointmentId: candidate.appointment.appointmentId,
        expectedPetId: candidate.appointment.petId,
        actualPetId: candidate.examResult.petId,
      });

const validateAll = (
  candidates: readonly Candidate[],
): Result<readonly Candidate[], CollectFollowUpTargetsError> =>
  candidates.reduce<Result<readonly Candidate[], CollectFollowUpTargetsError>>(
    (result, candidate) =>
      result.andThen((validated) => validateCandidate(candidate).map((item) => [...validated, item])),
    ok([]),
  );

const hasAppointmentId = (targets: readonly Target[], candidate: Candidate): boolean =>
  targets.some((target) => target.appointmentId === candidate.appointment.appointmentId);

export const collectFollowUpTargets = (
  candidates: readonly Candidate[],
): Result<readonly Target[], CollectFollowUpTargetsError> =>
  validateAll(candidates).map((validated) =>
    validated
      .filter(FollowUpCandidateModel.needsPhoneCall)
      .reduce<readonly Target[]>(
        (targets, candidate) =>
          hasAppointmentId(targets, candidate)
            ? targets
            : [...targets, FollowUpTargetModel.fromCandidate(candidate)],
        [],
      ),
  );
