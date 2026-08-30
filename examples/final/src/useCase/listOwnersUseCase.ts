import type { ResultAsync } from "neverthrow";

import type { Owner } from "../domain/owner/index.js";
import type { OwnerId } from "../domain/owner/index.js";
import type { OwnerEmail } from "../domain/owner/index.js";
import type { OwnerName } from "../domain/owner/index.js";
import type { OwnerPhone } from "../domain/owner/index.js";
import type { OwnerListResolver } from "../domain/owner/index.js";
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
export type UseCaseInput = Readonly<{ actorUserId: UserId }>;
export type UseCaseOk = Readonly<{ owners: readonly OwnerView[] }>;
export type UseCaseError = UnauthorizedError;
export type UseCaseOutput = ResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  ownerResolver: OwnerListResolver;
}>;
export type ListOwnersUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

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
      .andThen(ensureUserFound(input.actorUserId))
      .andThen(ensureCanManageClinic)
      .andThen(() =>
        dependencies.ownerResolver.resolveAll(),
      )
      .map((owners) => ({ owners: owners.map(toView) }));

export const ListOwnersUseCase = {
  create: (dependencies: Dependencies): ListOwnersUseCase => ({
    run: run(dependencies),
  }),
} as const;
