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
import { Owner, type OwnerProfile } from "../domain/owner/owner.js";
import type { OwnerEmail } from "../domain/owner/ownerEmail.js";
import type { OwnerId } from "../domain/owner/ownerId.js";
import type { OwnerName } from "../domain/owner/ownerName.js";
import type { OwnerPhone } from "../domain/owner/ownerPhone.js";
import type { OwnerByIdResolver } from "../domain/owner/ownerResolver.js";
import type { OwnerUpdatedStore } from "../domain/owner/ownerStores.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserByIdResolver } from "../domain/user/userResolver.js";
import { ensureCanManageClinic } from "./authorization.js";
import { ensureUserFound, type UnauthorizedError } from "./errors.js";

export type OwnerView = Readonly<{
  ownerId: OwnerId;
  name: OwnerName;
  email: OwnerEmail;
  phone: OwnerPhone;
}>;
export type UseCaseInput = Readonly<{
  actorUserId: UserId;
  ownerId: OwnerId;
  name: OwnerName;
  email: OwnerEmail;
  phone: OwnerPhone;
}>;
export type UseCaseOk = Readonly<{ owner: OwnerView }>;
export type OwnerNotFound = Readonly<{
  kind: "OwnerNotFound";
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
  | IdentityGenerationFailed
  | UseCaseRepositoryError;
export type UseCaseOutput = UseResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  ownerResolver: OwnerByIdResolver;
  ownerUpdatedStore: OwnerUpdatedStore;
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
}>;
export type UpdateOwnerUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({
  kind: "RepositoryError",
  operation: error.operation,
});
const ensureOwner =
  (ownerId: OwnerId) =>
  (owner: Owner | undefined): Result<Owner, OwnerNotFound> =>
    owner === undefined ? err({ kind: "OwnerNotFound", ownerId }) : ok(owner);
const toView = (owner: Owner): OwnerView => ({
  ownerId: owner.ownerId,
  name: owner.name,
  email: owner.email,
  phone: owner.phone,
});
const createEvent =
  (dependencies: Dependencies, input: UseCaseInput) => (owner: Owner) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        Owner.update({
          eventId: dependencies.eventIdGenerator.generate(),
          occurredAt: dependencies.clock.now(),
          actorUserId: input.actorUserId,
        })(owner, {
          name: input.name,
          email: input.email,
          phone: input.phone,
        } as const satisfies OwnerProfile),
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
      .andThen(createEvent(dependencies, input))
      .andThrough((event) =>
        dependencies.ownerUpdatedStore.store(event).mapErr(toRepositoryError),
      )
      .map((event) => ({ owner: toView(event.aggregateState) }));

export const UpdateOwnerUseCase = {
  create: (dependencies: Dependencies): UpdateOwnerUseCase => ({
    run: run(dependencies),
  }),
} as const;
