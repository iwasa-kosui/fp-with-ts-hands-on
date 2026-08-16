import type { ResultAsync } from "neverthrow";

import type { AppointmentId } from "../domain/appointment/appointmentId.js";
import {
  collectFollowUpTargets,
  type CollectFollowUpTargetsError,
} from "../domain/followUp/collectFollowUpTargets.js";
import type { FollowUpCandidate } from "../domain/followUp/followUpCandidate.js";
import type { FollowUpResolver } from "../domain/followUp/followUpResolver.js";
import type { OwnerName } from "../domain/owner/ownerName.js";
import type { OwnerPhone } from "../domain/owner/ownerPhone.js";
import type { PetId } from "../domain/pet/petId.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserByIdResolver } from "../domain/user/userResolver.js";
import { ensureUserFound, type UnauthorizedError } from "./errors.js";
import type { FollowUpRequestReader } from "./query/followUpRequestReader.js";

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

const wasRequested = (
  requestedAppointmentIds: readonly AppointmentId[],
  appointmentId: AppointmentId,
): boolean => requestedAppointmentIds.includes(appointmentId);
const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    dependencies.userResolver
      .resolveById(input.actorUserId)

      .andThen(ensureUserFound(input.actorUserId))
      .andThen(() =>
        dependencies.followUpResolver
          .resolveCandidates()
          ,
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
            ownerName: candidate?.owner.name,
            ownerPhone: target.ownerPhone,
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
