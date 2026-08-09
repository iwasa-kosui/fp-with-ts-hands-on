import { err, ok, type Result, type ResultAsync } from "neverthrow";

import type { RepositoryError } from "../domain/aggregate/repositoryError.js";
import type { Owner } from "../domain/owner/owner.js";
import type { OwnerId } from "../domain/owner/ownerId.js";
import type { OwnerEmail } from "../domain/owner/ownerEmail.js";
import type { OwnerName } from "../domain/owner/ownerName.js";
import type { OwnerPhone } from "../domain/owner/ownerPhone.js";
import type { OwnerByIdResolver } from "../domain/owner/ownerResolver.js";
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
export type UseCaseInput = Readonly<{ actorUserId: UserId; ownerId: OwnerId }>;
export type UseCaseOk = Readonly<{ owner: OwnerView }>;
export type OwnerNotFound = Readonly<{
  kind: "OwnerNotFound";
  ownerId: OwnerId;
}>;
export type UseCaseRepositoryError = Readonly<{
  kind: "RepositoryError";
  operation: string;
}>;
export type UseCaseError =
  UnauthorizedError | OwnerNotFound | UseCaseRepositoryError;
export type UseCaseOutput = ResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  ownerResolver: OwnerByIdResolver;
}>;
export type GetOwnerUseCase = Readonly<{
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
      .map((owner) => ({ owner: toView(owner) }));

export const GetOwnerUseCase = {
  create: (dependencies: Dependencies): GetOwnerUseCase => ({
    run: run(dependencies),
  }),
} as const;
