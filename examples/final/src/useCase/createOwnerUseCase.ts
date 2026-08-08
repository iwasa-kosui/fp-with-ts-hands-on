import { ResultAsync, type ResultAsync as UseResultAsync } from "neverthrow";

import type { Clock } from "../domain/aggregate/clock.js";
import type { EventIdGenerator } from "../domain/aggregate/eventIdGenerator.js";
import type { RepositoryError } from "../domain/aggregate/repositoryError.js";
import { Owner } from "../domain/owner/owner.js";
import type { OwnerEmail } from "../domain/owner/ownerEmail.js";
import type { OwnerId } from "../domain/owner/ownerId.js";
import type { OwnerName } from "../domain/owner/ownerName.js";
import type { OwnerPhone } from "../domain/owner/ownerPhone.js";
import type { OwnerCreatedStore } from "../domain/owner/ownerStores.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserByIdResolver } from "../domain/user/userResolver.js";
import { ensureCanManageClinic } from "./authorization.js";
import { ensureUserFound, type UnauthorizedError } from "./errors.js";

export type OwnerView = Readonly<{
  ownerId: OwnerId;
  name: string;
  email: string;
  phone: string;
}>;
export type UseCaseInput = Readonly<{
  actorUserId: UserId;
  name: OwnerName;
  email: OwnerEmail;
  phone: OwnerPhone;
}>;
export type UseCaseOk = Readonly<{ owner: OwnerView }>;
export type IdentityGenerationFailed = Readonly<{
  kind: "IdentityGenerationFailed";
}>;
export type UseCaseRepositoryError = Readonly<{
  kind: "RepositoryError";
  operation: string;
}>;
export type UseCaseError =
  UnauthorizedError | IdentityGenerationFailed | UseCaseRepositoryError;
export type UseCaseOutput = UseResultAsync<UseCaseOk, UseCaseError>;
export type OwnerIdGenerator = Readonly<{ generate: () => OwnerId }>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  ownerCreatedStore: OwnerCreatedStore;
  ownerIdGenerator: OwnerIdGenerator;
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
}>;
export type CreateOwnerUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({
  kind: "RepositoryError",
  operation: error.operation,
});
const toView = (owner: Owner): OwnerView => ({
  ownerId: owner.ownerId,
  name: owner.name.unwrap(),
  email: owner.email.unwrap(),
  phone: owner.phone.unwrap(),
});
const createEvent = (dependencies: Dependencies, input: UseCaseInput) =>
  ResultAsync.fromPromise(
    Promise.resolve().then(() => {
      const owner = {
        ownerId: dependencies.ownerIdGenerator.generate(),
        name: input.name,
        email: input.email,
        phone: input.phone,
      } as const satisfies Owner;
      return Owner.create({
        eventId: dependencies.eventIdGenerator.generate(),
        occurredAt: dependencies.clock.now(),
        actorUserId: input.actorUserId,
      })(owner);
    }),
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
      .andThen(() => createEvent(dependencies, input))
      .andThrough((event) =>
        dependencies.ownerCreatedStore.store(event).mapErr(toRepositoryError),
      )
      .map((event) => ({ owner: toView(event.aggregateState) }));

export const CreateOwnerUseCase = {
  create: (dependencies: Dependencies): CreateOwnerUseCase => ({
    run: run(dependencies),
  }),
} as const;
