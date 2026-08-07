import { err, ok, type Result } from "neverthrow";

import type { CollectFollowUpTargetsError } from "./collect-follow-up-targets-error.js";
import {
  FollowUpCandidate,
  FollowUpCandidates,
} from "./follow-up-candidate.js";
import { FollowUpTarget } from "./follow-up-target.js";

const validateFollowUpCandidate = (
  candidate: FollowUpCandidate,
): Result<FollowUpCandidate, CollectFollowUpTargetsError> =>
  FollowUpCandidate.matchesPet(candidate)
    ? ok(candidate)
    : err({
        kind: "ExamResultPetMismatch",
        appointmentId: candidate.appointment.appointmentId,
        expectedPetId: candidate.appointment.petId,
        actualPetId: candidate.examResult.petId,
      });

const collectValidatedCandidates = (
  candidates: ReadonlyArray<FollowUpCandidate>,
): Result<ReadonlyArray<FollowUpCandidate>, CollectFollowUpTargetsError> =>
  candidates.reduce<Result<ReadonlyArray<FollowUpCandidate>, CollectFollowUpTargetsError>>(
    (result, candidate) =>
      result.andThen((items) =>
        validateFollowUpCandidate(candidate).map((validated) => [...items, validated]),
      ),
    ok([]),
  );

export const collectFollowUpTargets = (
  raw: unknown,
): Result<ReadonlyArray<FollowUpTarget>, CollectFollowUpTargetsError> =>
  FollowUpCandidates.parse(raw)
    .andThen(collectValidatedCandidates)
    .map((candidates) =>
      candidates
        .filter(FollowUpCandidate.needsPhoneCall)
        .reduce<ReadonlyArray<FollowUpCandidate>>(
          (unique, candidate) =>
            unique.some(
              ({ appointment }) =>
                appointment.appointmentId === candidate.appointment.appointmentId,
            )
              ? unique
              : [...unique, candidate],
          [],
        )
        .map(FollowUpTarget.fromCandidate),
    );
