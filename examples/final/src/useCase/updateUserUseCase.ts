import {
  err,
  ok,
  ResultAsync,
  type Result,
  type ResultAsync as UseResultAsync,
} from "neverthrow";

import type { Clock } from "../domain/aggregate/clock.js";
import type { EventIdGenerator } from "../domain/aggregate/eventIdGenerator.js";
import type { VeterinarianId } from "../domain/appointment/index.js";
import { assertNever } from "../domain/shared/assertNever.js";
import { Permission } from "../domain/user/permission.js";
import type { Admin, User } from "../domain/user/user.js";
import { createUserUpdated } from "../domain/user/userEvent.js";
import type { UserEmail } from "../domain/user/userEmail.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserName } from "../domain/user/userName.js";
import type {
  UserByEmailResolver,
  UserByIdResolver,
} from "../domain/user/userResolver.js";
import type { UserUpdatedStore } from "../domain/user/userStores.js";
import { toUserView, type UserView } from "./userView.js";

export type { UserView } from "./userView.js";
export type UseCaseInput = Readonly<{
  actorUserId: UserId;
  targetUserId: UserId;
  email: UserEmail;
  name: UserName;
  role: User["kind"];
}>;
export type UseCaseOk = Readonly<{ user: UserView }>;
export type Unauthorized = Readonly<{
  kind: "Unauthorized";
  actorUserId: UserId;
}>;
export type UserNotFound = Readonly<{ kind: "UserNotFound"; userId: UserId }>;
export type UserEmailAlreadyExists = Readonly<{
  kind: "UserEmailAlreadyExists";
}>;
export type CannotDowngradeLastAdmin = Readonly<{
  kind: "CannotDowngradeLastAdmin";
}>;
export type IdentityGenerationFailed = Readonly<{
  kind: "IdentityGenerationFailed";
}>;
export type UseCaseError =
  | Unauthorized
  | UserNotFound
  | UserEmailAlreadyExists
  | CannotDowngradeLastAdmin
  | IdentityGenerationFailed;
export type UseCaseOutput = UseResultAsync<UseCaseOk, UseCaseError>;
export type VeterinarianIdGenerator = Readonly<{
  generate: () => VeterinarianId;
}>;
export type Dependencies = Readonly<{
  userByIdResolver: UserByIdResolver;
  userByEmailResolver: UserByEmailResolver;
  userUpdatedStore: UserUpdatedStore;
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
  veterinarianIdGenerator: VeterinarianIdGenerator;
}>;
export type UpdateUserUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const ensureActor =
  (actorUserId: UserId) =>
  (user: User | undefined): Result<User, Unauthorized> =>
    user === undefined ? err({ kind: "Unauthorized", actorUserId }) : ok(user);
const ensureAdmin = (user: User): Result<Admin, Unauthorized> =>
  Permission.isAdmin(user)
    ? ok(user)
    : err({ kind: "Unauthorized", actorUserId: user.userId });
const ensureTarget =
  (userId: UserId) =>
  (user: User | undefined): Result<User, UserNotFound> =>
    user === undefined ? err({ kind: "UserNotFound", userId }) : ok(user);
const ensureEmailAvailable =
  (targetUserId: UserId) =>
  (user: User | undefined): Result<void, UserEmailAlreadyExists> =>
    user === undefined || user.userId === targetUserId
      ? ok(undefined)
      : err({ kind: "UserEmailAlreadyExists" });
const updateState =
  (dependencies: Dependencies, input: UseCaseInput) => (user: User) =>
    ResultAsync.fromPromise(
      Promise.resolve().then((): User => {
        const base = {
          userId: user.userId,
          email: input.email,
          name: input.name,
          passwordHash: user.passwordHash,
        } as const;
        switch (input.role) {
          case "Admin":
            return { kind: "Admin", ...base };
          case "Receptionist":
            return { kind: "Receptionist", ...base };
          case "Veterinarian":
            return {
              kind: "Veterinarian",
              ...base,
              veterinarianId:
                user.kind === "Veterinarian"
                  ? user.veterinarianId
                  : dependencies.veterinarianIdGenerator.generate(),
            };
          default:
            return assertNever(input.role);
        }
      }),
      (): IdentityGenerationFailed => ({ kind: "IdentityGenerationFailed" }),
    );
const createEvent =
  (dependencies: Dependencies, actorUserId: UserId) => (user: User) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        createUserUpdated(
          {
            eventId: dependencies.eventIdGenerator.generate(),
            occurredAt: dependencies.clock.now(),
            actorUserId,
          },
          user,
        ),
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
      .andThen((target) =>
        dependencies.userByEmailResolver
          .resolveByEmail(input.email)
          .andThen(ensureEmailAvailable(target.userId))
          .map(() => target),
      )
      .andThen(updateState(dependencies, input))
      .andThen(createEvent(dependencies, input.actorUserId))
      .andThrough((event) =>
        dependencies.userUpdatedStore.store(event),
      )
      .map((event) => ({ user: toUserView(event.aggregateState) }));

export const UpdateUserUseCase = {
  create: (dependencies: Dependencies): UpdateUserUseCase => ({
    run: run(dependencies),
  }),
} as const;
