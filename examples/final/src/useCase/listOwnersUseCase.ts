import type { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../domain/aggregate/repositoryError.js";
import type { Owner } from "../domain/owner/owner.js";
import type { OwnerId } from "../domain/owner/ownerId.js";
import type { OwnerResolver } from "../domain/owner/ownerResolver.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserResolver } from "../domain/user/userResolver.js";
import { ensureCanManageClinic } from "./authorization.js";
import { ensureUserFound, type UnauthorizedError } from "./errors.js";

export type OwnerView = Readonly<{
  ownerId: OwnerId;
  name: string;
  email: string;
  phone: string;
}>;
export type UseCaseInput = Readonly<{ actorUserId: UserId }>;
export type UseCaseOk = Readonly<{ owners: readonly OwnerView[] }>;
export type UseCaseRepositoryError = Readonly<{
  kind: "RepositoryError";
  operation: string;
}>;
export type UseCaseError = UnauthorizedError | UseCaseRepositoryError;
export type UseCaseOutput = ResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserResolver;
  ownerResolver: OwnerResolver;
}>;
export type ListOwnersUseCase = Readonly<{
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
const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    dependencies.userResolver
      .resolveById(input.actorUserId)
      .mapErr(toRepositoryError)
      .andThen(ensureUserFound(input.actorUserId))
      .andThen(ensureCanManageClinic)
      .andThen(() =>
        dependencies.ownerResolver.resolveAll().mapErr(toRepositoryError),
      )
      .map((owners) => ({ owners: owners.map(toView) }));

export const ListOwnersUseCase = {
  create: (dependencies: Dependencies): ListOwnersUseCase => ({
    run: run(dependencies),
  }),
} as const;
