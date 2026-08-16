import { ok, safeTry, type ResultAsync } from "neverthrow";

import type { AppointmentId } from "../domain/appointment/appointmentId.js";
import {
  collectFollowUpTargets,
  type CollectFollowUpTargetsError,
  type FollowUpTarget,
} from "../domain/followUp/collectFollowUpTargets.js";
import type { FollowUpCandidate } from "../domain/followUp/followUpCandidate.js";
import type { FollowUpRequestReader } from "../domain/followUp/followUpRequestReader.js";
import type { FollowUpResolver } from "../domain/followUp/followUpResolver.js";
import type { OwnerName } from "../domain/owner/ownerName.js";
import type { OwnerPhone } from "../domain/owner/ownerPhone.js";
import type { PetId } from "../domain/pet/petId.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserByIdResolver } from "../domain/user/userResolver.js";
import { ensureUserFound, type UnauthorizedError } from "./errors.js";

export type FollowUpView = Readonly<{
  appointmentId: AppointmentId;
  petId: PetId;
  ownerName: OwnerName | undefined;
  ownerPhone: OwnerPhone;
  requested: boolean;
}>;
export type UseCaseInput = Readonly<{ actorUserId: UserId }>;
export type UseCaseOk = Readonly<{ followUps: readonly FollowUpView[] }>;
export type UseCaseError =
  UnauthorizedError | CollectFollowUpTargetsError;
export type UseCaseOutput = ResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  followUpResolver: FollowUpResolver;
  followUpRequestReader: FollowUpRequestReader;
}>;
export type ListFollowUpsUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

type FollowUpSources = Readonly<{
  candidates: readonly FollowUpCandidate[];
  targets: readonly FollowUpTarget[];
  requestedAppointmentIds: readonly AppointmentId[];
}>;

const wasRequested = (
  requestedAppointmentIds: readonly AppointmentId[],
  appointmentId: AppointmentId,
): boolean => requestedAppointmentIds.includes(appointmentId);
const loadSources =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): ResultAsync<FollowUpSources, UseCaseError> =>
    safeTry<FollowUpSources, UseCaseError>(async function* () {
      const actor = yield* dependencies.userResolver.resolveById(input.actorUserId);
      yield* ensureUserFound(input.actorUserId)(actor);
      const candidates = yield* dependencies.followUpResolver.resolveCandidates();
      const targets = yield* collectFollowUpTargets(candidates);
      const requestedAppointmentIds =
        yield* dependencies.followUpRequestReader.listRequestedAppointmentIds();
      return ok({ candidates, targets, requestedAppointmentIds });
    });

const toFollowUps = ({
  candidates,
  targets,
  requestedAppointmentIds,
}: FollowUpSources): UseCaseOk => ({
  followUps: targets.map((target) => {
    const candidate: FollowUpCandidate | undefined = candidates.find(
      (item) => item.appointment.appointmentId === target.appointmentId,
    );
    return {
      appointmentId: target.appointmentId,
      petId: target.petId,
      ownerName: candidate?.owner.name,
      ownerPhone: target.ownerPhone,
      requested: wasRequested(requestedAppointmentIds, target.appointmentId),
    };
  }),
});

const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    loadSources(dependencies)(input).map(toFollowUps);

export const ListFollowUpsUseCase = {
  create: (dependencies: Dependencies): ListFollowUpsUseCase => ({
    run: run(dependencies),
  }),
} as const;
