import { err, ok, type Result, type ResultAsync } from "neverthrow";

import type { Owner } from "../domain/owner/index.js";
import type { OwnerId } from "../domain/owner/index.js";
import type { OwnerEmail } from "../domain/owner/index.js";
import type { OwnerName } from "../domain/owner/index.js";
import type { OwnerPhone } from "../domain/owner/index.js";
import type { OwnerByIdResolver } from "../domain/owner/index.js";
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
export type UseCaseError =
  UnauthorizedError | OwnerNotFound;
export type UseCaseOutput = ResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  ownerResolver: OwnerByIdResolver;
}>;
export type GetOwnerUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

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
      .andThen(ensureUserFound(input.actorUserId))
      .andThen(ensureCanManageClinic)
      .andThen(() =>
        dependencies.ownerResolver.resolveById(input.ownerId),
      )
      .andThen(ensureOwner(input.ownerId))
      .map((owner) => ({ owner: toView(owner) }));

export const GetOwnerUseCase = {
  create: (dependencies: Dependencies): GetOwnerUseCase => ({
    run: run(dependencies),
  }),
} as const;
