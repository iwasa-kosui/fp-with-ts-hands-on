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
import { Permission } from "../domain/user/permission.js";
import {
  User,
  type Admin,
  type User as UserState,
} from "../domain/user/user.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserResolver } from "../domain/user/userResolver.js";
import type {
  UserDeletedStore,
  UserDeletedStoreError,
} from "../domain/user/userStores.js";

export type UseCaseInput = Readonly<{
  actorUserId: UserId;
  targetUserId: UserId;
}>;
export type UseCaseOk = Readonly<{ userId: UserId }>;
export type Unauthorized = Readonly<{
  kind: "Unauthorized";
  actorUserId: UserId;
}>;
export type UserNotFound = Readonly<{ kind: "UserNotFound"; userId: UserId }>;
export type CannotDeleteSelf = Readonly<{ kind: "CannotDeleteSelf" }>;
export type CannotDeleteLastAdmin = Readonly<{ kind: "CannotDeleteLastAdmin" }>;
export type IdentityGenerationFailed = Readonly<{
  kind: "IdentityGenerationFailed";
}>;
export type UseCaseRepositoryError = Readonly<{
  kind: "RepositoryError";
  operation: string;
}>;
export type UseCaseError =
  | Unauthorized
  | UserNotFound
  | CannotDeleteSelf
  | CannotDeleteLastAdmin
  | IdentityGenerationFailed
  | UseCaseRepositoryError;
export type UseCaseOutput = UseResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserResolver;
  userDeletedStore: UserDeletedStore;
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
}>;
export type DeleteUserUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({
  kind: "RepositoryError",
  operation: error.operation,
});
const toStoreError = (
  error: UserDeletedStoreError,
): CannotDeleteLastAdmin | UseCaseRepositoryError =>
  error.kind === "CannotDeleteLastAdmin" ? error : toRepositoryError(error);
const ensureActor =
  (actorUserId: UserId) =>
  (user: UserState | undefined): Result<UserState, Unauthorized> =>
    user === undefined ? err({ kind: "Unauthorized", actorUserId }) : ok(user);
const ensureAdmin = (user: UserState): Result<Admin, Unauthorized> =>
  Permission.isAdmin(user)
    ? ok(user)
    : err({ kind: "Unauthorized", actorUserId: user.userId });
const ensureTarget =
  (userId: UserId) =>
  (user: UserState | undefined): Result<UserState, UserNotFound> =>
    user === undefined ? err({ kind: "UserNotFound", userId }) : ok(user);
const ensureNotSelf =
  (actorUserId: UserId) =>
  (target: UserState): Result<UserState, CannotDeleteSelf> =>
    target.userId === actorUserId
      ? err({ kind: "CannotDeleteSelf" })
      : ok(target);
const ensureNotLastAdmin =
  (users: readonly UserState[]) =>
  (target: UserState): Result<UserState, CannotDeleteLastAdmin> =>
    target.kind !== "Admin" || users.filter(Permission.isAdmin).length > 1
      ? ok(target)
      : err({ kind: "CannotDeleteLastAdmin" });
const createEvent =
  (dependencies: Dependencies, actorUserId: UserId) => (user: UserState) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        User.delete({
          eventId: dependencies.eventIdGenerator.generate(),
          occurredAt: dependencies.clock.now(),
          actorUserId,
        })(user),
      ),
      (): IdentityGenerationFailed => ({ kind: "IdentityGenerationFailed" }),
    );

const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    dependencies.userResolver
      .resolveById(input.actorUserId)
      .mapErr(toRepositoryError)
      .andThen(ensureActor(input.actorUserId))
      .andThen(ensureAdmin)
      .andThen(() =>
        dependencies.userResolver
          .resolveById(input.targetUserId)
          .mapErr(toRepositoryError),
      )
      .andThen(ensureTarget(input.targetUserId))
      .andThen(ensureNotSelf(input.actorUserId))
      .andThen((target) =>
        dependencies.userResolver
          .resolveAll()
          .mapErr(toRepositoryError)
          .andThen((users) => ensureNotLastAdmin(users)(target)),
      )
      .andThen(createEvent(dependencies, input.actorUserId))
      .andThrough((event) =>
        dependencies.userDeletedStore.store(event).mapErr(toStoreError),
      )
      .map((event) => ({ userId: event.aggregateId }));

export const DeleteUserUseCase = {
  create: (dependencies: Dependencies): DeleteUserUseCase => ({
    run: run(dependencies),
  }),
} as const;
