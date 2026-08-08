import {
  err,
  ok,
  ResultAsync,
  type Result,
  type ResultAsync as UseResultAsync,
} from "neverthrow";

import type { Clock } from "../domain/aggregate/clock.js";
import type { EventIdGenerator } from "../domain/aggregate/eventIdGenerator.js";
import type { RepositoryError } from "../domain/aggregate/repositoryError.js";
import { Owner } from "../domain/owner/owner.js";
import type { OwnerId } from "../domain/owner/ownerId.js";
import type { OwnerResolver } from "../domain/owner/ownerResolver.js";
import type {
  OwnerDeletedStore,
  OwnerDeletedStoreError,
} from "../domain/owner/ownerStores.js";
import type { Pet } from "../domain/pet/pet.js";
import type { PetResolver } from "../domain/pet/petResolver.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserResolver } from "../domain/user/userResolver.js";
import { ensureCanManageClinic } from "./authorization.js";
import { ensureUserFound, type UnauthorizedError } from "./errors.js";

export type UseCaseInput = Readonly<{ actorUserId: UserId; ownerId: OwnerId }>;
export type UseCaseOk = Readonly<{ ownerId: OwnerId }>;
export type OwnerNotFound = Readonly<{
  kind: "OwnerNotFound";
  ownerId: OwnerId;
}>;
export type OwnerHasPets = Readonly<{ kind: "OwnerHasPets"; ownerId: OwnerId }>;
export type OwnerDeletionConflict = Readonly<{
  kind: "OwnerDeletionConflict";
  ownerId: OwnerId;
}>;
export type IdentityGenerationFailed = Readonly<{
  kind: "IdentityGenerationFailed";
}>;
export type UseCaseRepositoryError = Readonly<{
  kind: "RepositoryError";
  operation: string;
}>;
export type UseCaseError =
  | UnauthorizedError
  | OwnerNotFound
  | OwnerHasPets
  | OwnerDeletionConflict
  | IdentityGenerationFailed
  | UseCaseRepositoryError;
export type UseCaseOutput = UseResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserResolver;
  ownerResolver: OwnerResolver;
  petResolver: PetResolver;
  ownerDeletedStore: OwnerDeletedStore;
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
}>;
export type DeleteOwnerUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({
  kind: "RepositoryError",
  operation: error.operation,
});
const toStoreError = (
  error: OwnerDeletedStoreError,
):
  | OwnerNotFound
  | OwnerHasPets
  | OwnerDeletionConflict
  | UseCaseRepositoryError =>
  error.kind === "RepositoryError" ? toRepositoryError(error) : error;
const ensureOwner =
  (ownerId: OwnerId) =>
  (owner: Owner | undefined): Result<Owner, OwnerNotFound> =>
    owner === undefined ? err({ kind: "OwnerNotFound", ownerId }) : ok(owner);
const ensureNoPets =
  (ownerId: OwnerId) =>
  (pets: readonly Pet[]): Result<void, OwnerHasPets> =>
    pets.length === 0 ? ok(undefined) : err({ kind: "OwnerHasPets", ownerId });
const createEvent =
  (dependencies: Dependencies, input: UseCaseInput) => (owner: Owner) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        Owner.delete({
          eventId: dependencies.eventIdGenerator.generate(),
          occurredAt: dependencies.clock.now(),
          actorUserId: input.actorUserId,
        })(owner),
      ),
      (): IdentityGenerationFailed => ({ kind: "IdentityGenerationFailed" }),
    );
const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    dependencies.userResolver
      .resolveById(input.actorUserId)
      .mapErr(toRepositoryError)
      .andThen(ensureUserFound(input.actorUserId))
      .andThen(ensureCanManageClinic)
      .andThen(() =>
        dependencies.ownerResolver
          .resolveById(input.ownerId)
          .mapErr(toRepositoryError),
      )
      .andThen(ensureOwner(input.ownerId))
      .andThen((owner) =>
        dependencies.petResolver
          .resolveByOwnerId(input.ownerId)
          .mapErr(toRepositoryError)
          .andThen(ensureNoPets(input.ownerId))
          .map(() => owner),
      )
      .andThen(createEvent(dependencies, input))
      .andThrough((event) =>
        dependencies.ownerDeletedStore.store(event).mapErr(toStoreError),
      )
      .map((event) => ({ ownerId: event.aggregateId }));

export const DeleteOwnerUseCase = {
  create: (dependencies: Dependencies): DeleteOwnerUseCase => ({
    run: run(dependencies),
  }),
} as const;
