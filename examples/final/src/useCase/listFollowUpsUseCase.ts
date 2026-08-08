import type { ResultAsync } from "neverthrow";

import type { AnyDomainEvent } from "../domain/aggregate/domainEvent.js";
import type { DomainEventResolver } from "../domain/aggregate/domainEventResolver.js";
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
  eventResolver: DomainEventResolver;
}>;
export type ListFollowUpsUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({
  kind: "RepositoryError",
  operation: error.operation,
});
const wasRequested = (
  events: readonly AnyDomainEvent[],
  appointmentId: AppointmentId,
): boolean =>
  events.some(
    (event) =>
      event.eventName === "follow-up.requested" &&
      event.aggregateId === appointmentId,
  );
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
        dependencies.eventResolver
          .resolveAll()
          .mapErr(toRepositoryError)
          .map((events) => ({ candidates, targets, events })),
      )
      .map(({ candidates, targets, events }) => ({
        followUps: targets.map((target) => {
          const candidate: FollowUpCandidate | undefined = candidates.find(
            (item) => item.appointment.appointmentId === target.appointmentId,
          );
          return {
            appointmentId: target.appointmentId,
            petId: target.petId,
            ownerName: candidate?.owner.name.unwrap() ?? "削除済み",
            ownerPhone: target.ownerPhone.unwrap(),
            requested: wasRequested(events, target.appointmentId),
          };
        }),
      }));

export const ListFollowUpsUseCase = {
  create: (dependencies: Dependencies): ListFollowUpsUseCase => ({
    run: run(dependencies),
  }),
} as const;
