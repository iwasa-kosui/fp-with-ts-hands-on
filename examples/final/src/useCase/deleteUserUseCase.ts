import {
  err,
  ok,
  ResultAsync,
  type Result,
  type ResultAsync as UseResultAsync,
} from "neverthrow";

import type { Clock } from "../domain/aggregate/clock.js";
import type { EventIdGenerator } from "../domain/aggregate/eventIdGenerator.js";
import { Permission } from "../domain/user/permission.js";
import {
  User,
  type Admin,
  type User as UserState,
} from "../domain/user/user.js";
import type { UserId } from "../domain/user/userId.js";
import type {
  UserByIdResolver,
  UserListResolver,
} from "../domain/user/userResolver.js";
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
export type UseCaseError =
  | Unauthorized
  | UserNotFound
  | CannotDeleteSelf
  | CannotDeleteLastAdmin
  | IdentityGenerationFailed;
export type UseCaseOutput = UseResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userByIdResolver: UserByIdResolver;
  userListResolver: UserListResolver;
  userDeletedStore: UserDeletedStore;
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
}>;
export type DeleteUserUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

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
    dependencies.userByIdResolver
      .resolveById(input.actorUserId)
      .andThen(ensureActor(input.actorUserId))
      .andThen(ensureAdmin)
      .andThen(() =>
        dependencies.userByIdResolver.resolveById(input.targetUserId),
      )
      .andThen(ensureTarget(input.targetUserId))
      .andThen(ensureNotSelf(input.actorUserId))
      .andThen((target) =>
        dependencies.userListResolver
          .resolveAll()
          .andThen((users) => ensureNotLastAdmin(users)(target)),
      )
      .andThen(createEvent(dependencies, input.actorUserId))
      .andThrough((event) =>
        dependencies.userDeletedStore.store(event),
      )
      .map((event) => ({ userId: event.aggregateId }));

export const DeleteUserUseCase = {
  create: (dependencies: Dependencies): DeleteUserUseCase => ({
    run: run(dependencies),
  }),
} as const;
