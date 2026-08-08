import type { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../domain/aggregate/repositoryError.js";
import type { AppointmentId } from "../domain/appointment/appointmentId.js";
import {
  collectFollowUpTargets,
  type CollectFollowUpTargetsError,
} from "../domain/followUp/collectFollowUpTargets.js";
import type { FollowUpCandidate } from "../domain/followUp/followUpCandidate.js";
import type { FollowUpResolver } from "../domain/followUp/followUpResolver.js";
import type { PetId } from "../domain/pet/petId.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserByIdResolver } from "../domain/user/userResolver.js";
import { ensureUserFound, type UnauthorizedError } from "./errors.js";
import type { FollowUpRequestReader } from "./query/followUpRequestReader.js";

export type FollowUpView = Readonly<{
  appointmentId: AppointmentId;
  petId: PetId;
  ownerName: string;
  ownerPhone: string;
  requested: boolean;
}>;
export type UseCaseInput = Readonly<{ actorUserId: UserId }>;
export type UseCaseOk = Readonly<{ followUps: readonly FollowUpView[] }>;
export type UseCaseRepositoryError = Readonly<{
  kind: "RepositoryError";
  operation: string;
}>;
export type UseCaseError =
  UnauthorizedError | CollectFollowUpTargetsError | UseCaseRepositoryError;
export type UseCaseOutput = ResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  followUpResolver: FollowUpResolver;
  followUpRequestReader: FollowUpRequestReader;
}>;
export type ListFollowUpsUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({
  kind: "RepositoryError",
  operation: error.operation,
});
const wasRequested = (
  requestedAppointmentIds: readonly AppointmentId[],
  appointmentId: AppointmentId,
): boolean => requestedAppointmentIds.includes(appointmentId);
const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    dependencies.userResolver
      .resolveById(input.actorUserId)
      .mapErr(toRepositoryError)
      .andThen(ensureUserFound(input.actorUserId))
      .andThen(() =>
        dependencies.followUpResolver
          .resolveCandidates()
          .mapErr(toRepositoryError),
      )
      .andThen((candidates) =>
        collectFollowUpTargets(candidates).map((targets) => ({
          candidates,
          targets,
        })),
      )
      .andThen(({ candidates, targets }) =>
        dependencies.followUpRequestReader
          .listRequestedAppointmentIds()
          .mapErr(toRepositoryError)
          .map((requestedAppointmentIds) => ({
            candidates,
            targets,
            requestedAppointmentIds,
          })),
      )
      .map(({ candidates, targets, requestedAppointmentIds }) => ({
        followUps: targets.map((target) => {
          const candidate: FollowUpCandidate | undefined = candidates.find(
            (item) => item.appointment.appointmentId === target.appointmentId,
          );
          return {
            appointmentId: target.appointmentId,
            petId: target.petId,
            ownerName: candidate?.owner.name.unwrap() ?? "削除済み",
            ownerPhone: target.ownerPhone.unwrap(),
            requested: wasRequested(
              requestedAppointmentIds,
              target.appointmentId,
            ),
          };
        }),
      }));

export const ListFollowUpsUseCase = {
  create: (dependencies: Dependencies): ListFollowUpsUseCase => ({
    run: run(dependencies),
  }),
} as const;
